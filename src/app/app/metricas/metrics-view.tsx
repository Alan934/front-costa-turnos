"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarCheck2,
  DollarSign,
  UserPlus,
  UserX,
  Printer,
  Sheet,
  UserMinus,
  Receipt,
  Gauge,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ArrowUp,
  ArrowDown,
  TriangleAlert,
  MessageCircle,
  Sparkles,
  BarChart3,
  Building2,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/state-views";
import { useMetrics } from "@/lib/api/metrics";
import { useActiveComercio } from "@/components/comercio-context";
import { useTokenColors } from "@/lib/use-token-colors";
import { formatMoney } from "@/lib/format";
import { whatsAppLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { capitalize, pct, periodPhrase, periodRangeLabel, periodTitle, plural } from "@/lib/metrics-format";
import type { MetricsOverviewDto } from "@/lib/api/generated/model/metricsOverviewDto";
import type { MetricsTotalsDto } from "@/lib/api/generated/model/metricsTotalsDto";

type Range = "week" | "month";

export function MetricsView() {
  const [range, setRange] = useState<Range>("week");
  const [offset, setOffset] = useState(0);
  // null = todos los comercios. El selector solo aparece si atiende en más de uno.
  const [comercioId, setComercioId] = useState<string | null>(null);
  const { options: comercios } = useActiveComercio();
  const { data, isLoading, isError, isFetching, refetch } = useMetrics(range, offset, comercioId);
  const comercioName = comercios.find((c) => c.comercioId === comercioId)?.name ?? null;

  const changeRange = (r: Range) => {
    setRange(r);
    setOffset(0);
  };

  return (
    <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Métricas</h1>
          <p className="text-sm text-muted-foreground">Cómo viene tu negocio</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <div className="flex items-center rounded-lg border border-border p-0.5 text-sm font-medium">
            {(["week", "month"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => changeRange(r)}
                aria-pressed={range === r}
                className={cn(
                  "rounded-md px-3 py-1.5 transition-colors",
                  range === r ? "bg-accent/10 text-accent" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r === "week" ? "Semana" : "Mes"}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={printReport} title="Imprimir o guardar como PDF">
            <Printer className="size-4" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => data && exportCsv(data)}
            disabled={!data}
            title="Descargar para abrir en Excel"
          >
            <Sheet className="size-4" />
            <span className="hidden sm:inline">Excel</span>
          </Button>
        </div>
      </div>

      {/* Navegación de períodos */}
      <div className="mt-5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOffset((o) => o + 1)}
          className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground print:hidden"
          aria-label={range === "week" ? "Semana anterior" : "Mes anterior"}
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1 text-center sm:flex-none sm:px-2 sm:text-left">
          <p className="font-display text-base font-semibold">{periodTitle(range, offset)}</p>
          <p className="text-xs text-muted-foreground">
            {data ? periodRangeLabel(data.period, range) : " "}
            {isFetching && !isLoading && <span className="ml-1.5 print:hidden">· actualizando…</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOffset((o) => Math.max(0, o - 1))}
          disabled={offset === 0}
          className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 print:hidden"
          aria-label={range === "week" ? "Semana siguiente" : "Mes siguiente"}
        >
          <ChevronRight className="size-4" />
        </button>
        {offset > 0 && (
          <button
            type="button"
            onClick={() => setOffset(0)}
            className="ml-1 text-xs font-medium text-accent hover:underline print:hidden"
          >
            {range === "week" ? "Ir a esta semana" : "Ir a este mes"}
          </button>
        )}
        {comercios.length > 1 && (
          <div className="relative ml-auto print:hidden">
            <label htmlFor="metrics-comercio" className="sr-only">
              Comercio
            </label>
            <Building2 className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <select
              id="metrics-comercio"
              value={comercioId ?? ""}
              onChange={(e) => setComercioId(e.target.value || null)}
              className="h-9 max-w-[12rem] appearance-none truncate rounded-lg border border-border bg-background pl-8 pr-3 text-sm font-medium outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todos tus comercios</option>
              {comercios.map((c) => (
                <option key={c.comercioId} value={c.comercioId}>
                  {c.name}
                  {c.isPersonal ? " (tu negocio)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {comercioName && (
        <p className="mt-2 text-xs text-muted-foreground">
          Mostrando solo lo que pasó en <b className="text-foreground">{comercioName}</b>.
        </p>
      )}

      {isLoading && <MetricsSkeleton />}
      {isError && !data && (
        <ErrorState className="mt-6" message="No pudimos cargar las métricas." onRetry={() => refetch()} />
      )}
      {data && <MetricsContent data={data} range={range} filtered={comercioId != null} />}
    </div>
  );
}

function MetricsContent({ data, range, filtered }: { data: MetricsOverviewDto; range: Range; filtered: boolean }) {
  const c = useTokenColors();
  const t = data.totals;
  const p = data.previousTotals;
  const vs = range === "week" ? "vs. semana anterior" : "vs. mes anterior";
  const isEmpty = t.appointments === 0 && t.incomeCents === 0;
  const totalClients = data.newVsReturning.nuevos + data.newVsReturning.recurrentes;
  const topServices = data.services.slice(0, 6);
  const maxBilled = Math.max(1, ...topServices.map((s) => s.billedCents));

  return (
    <div className="mt-5 space-y-6">
      {data.pending.unclosedAppointments > 0 && (
        <Link
          href="/app/caja"
          className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm hover:bg-warning/15 print:hidden"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            Tenés <b>{plural(data.pending.unclosedAppointments, "turno pasado", "turnos pasados")} sin cerrar</b>.
            Marcalos como atendidos o ausentes en <span className="font-medium underline">Cierre de caja</span>{" "}
            para que estas métricas sean exactas.
          </span>
        </Link>
      )}

      <Summary data={data} range={range} />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi
          icon={<CalendarCheck2 className="size-4" />}
          value={String(t.attended)}
          label="Atendidos"
          help="Turnos que marcaste como terminados en el período."
          delta={<Delta current={t.attended} previous={p.attended} kind="count" />}
          vs={vs}
        />
        <Kpi
          icon={<DollarSign className="size-4" />}
          value={formatMoney(t.incomeCents)}
          label="Cobrado"
          help="Plata que entró en el período: señas, Mercado Pago, efectivo y transferencias confirmadas, según el día en que se cobró. No incluye IVA."
          delta={<Delta current={t.incomeCents} previous={p.incomeCents} kind="percent" />}
          vs={vs}
        />
        <Kpi
          icon={<Receipt className="size-4" />}
          value={formatMoney(t.averageTicketCents)}
          label="Ticket promedio"
          help="Cuánto vale en promedio cada atención, según el precio de tus servicios."
          delta={<Delta current={t.averageTicketCents} previous={p.averageTicketCents} kind="percent" />}
          vs={vs}
        />
        <Kpi
          icon={<Gauge className="size-4" />}
          value={t.occupancyRate == null ? "—" : pct(t.occupancyRate)}
          label="Agenda ocupada"
          help={
            t.occupancyRate == null
              ? "Para calcularla necesitamos tus horarios de atención con turno. Cargalos en Horarios."
              : `De tus horarios con turno, qué parte estuvo reservada (${formatHours(t.bookedMinutes)} de ${formatHours(t.availableMinutes)}). Ya descuenta descansos, bloqueos y feriados.`
          }
          delta={
            t.occupancyRate != null && p.occupancyRate != null ? (
              <Delta current={t.occupancyRate} previous={p.occupancyRate} kind="points" />
            ) : null
          }
          vs={vs}
        />
        <Kpi
          icon={<UserPlus className="size-4" />}
          value={String(t.newClients)}
          label="Clientes nuevos"
          help="Personas que atendiste por primera vez en este período."
          delta={<Delta current={t.newClients} previous={p.newClients} kind="count" />}
          vs={vs}
        />
        <Kpi
          icon={<UserX className="size-4" />}
          value={pct(t.noShowRate)}
          label="Ausencias"
          sub={t.noShow > 0 ? plural(t.noShow, "no vino", "no vinieron") : undefined}
          help="De los turnos que llegaron a su horario, qué porcentaje no vino sin avisar. Cuanto más bajo, mejor."
          delta={<Delta current={t.noShowRate} previous={p.noShowRate} kind="points" invert />}
          vs={vs}
        />
      </div>

      {/* Plata */}
      <Card
        title="Facturado, cobrado y pendiente"
        help="Facturado es lo que vale lo que atendiste según tus precios. Cobrado es lo que efectivamente entró. Pueden no coincidir: una seña se cobra antes del turno y un pagaré después."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <MoneyStat label="Facturado" value={t.billedCents} hint="Valor de lo atendido" />
          <MoneyStat label="Cobrado" value={t.incomeCents} hint="Lo que entró en el período" />
          <MoneyStat
            label="Te deben"
            value={data.pending.cashCents}
            hint={
              data.pending.cashCount > 0
                ? `${plural(data.pending.cashCount, "cobro", "cobros")} en efectivo o transferencia sin confirmar, a hoy`
                : "Nada pendiente, a hoy"
            }
            href={data.pending.cashCount > 0 ? "/app/caja" : undefined}
            tone={data.pending.cashCents > 0 ? "warning" : undefined}
          />
        </div>
        {data.retainedDeposits.count > 0 && (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-success/10 px-3 py-2 text-xs">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
            <span>
              Las señas te salvaron <b>{formatMoney(data.retainedDeposits.cents)}</b> en{" "}
              {plural(data.retainedDeposits.count, "turno al que no vinieron", "turnos a los que no vinieron")}.
            </span>
          </p>
        )}
      </Card>

      {isEmpty ? (
        <EmptyPeriod range={range} isCurrent={data.period.isCurrent} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Turnos por día" help="Cómo terminó cada turno, día por día.">
            <ChartLegend
              items={[
                { color: c.done, label: "Atendidos" },
                { color: c.cancelled, label: "Cancelados" },
                { color: c.waiting, label: "No vinieron" },
              ]}
            />
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={data.attendanceByDay} barCategoryGap={data.attendanceByDay.length > 10 ? "12%" : "28%"}>
                <CartesianGrid strokeDasharray="3 3" stroke={c.border} vertical={false} />
                <XAxis dataKey="label" stroke={c.muted} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={c.muted} fontSize={12} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: c.border, opacity: 0.3 }} />
                <Bar dataKey="atendidos" name="Atendidos" fill={c.done} radius={[4, 4, 0, 0]} />
                <Bar dataKey="cancelados" name="Cancelados" fill={c.cancelled} radius={[4, 4, 0, 0]} />
                <Bar dataKey="ausentes" name="No vinieron" fill={c.waiting} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Cobrado por día" help="Lo que entró cada día, según la fecha de cobro.">
            {t.incomeCents === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">No hubo cobros en este período.</p>
            ) : (
            <ResponsiveContainer width="100%" height={256}>
              <BarChart data={data.incomeByDay} barCategoryGap={data.incomeByDay.length > 10 ? "12%" : "28%"}>
                <CartesianGrid strokeDasharray="3 3" stroke={c.border} vertical={false} />
                <XAxis dataKey="label" stroke={c.muted} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  stroke={c.muted}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={62}
                  tickFormatter={(v) => formatMoneyShort(v as number)}
                />
                <Tooltip content={<ChartTooltip money />} cursor={{ fill: c.border, opacity: 0.3 }} />
                <Bar dataKey="cents" name="Cobrado" fill={c.accent} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            )}
          </Card>

          <Card
            title="Servicios que más te dejan"
            help="Servicios atendidos en el período, ordenados por lo que facturaron según su precio."
          >
            {topServices.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">Todavía no atendiste turnos en este período.</p>
            ) : (
              <ul className="space-y-3">
                {topServices.map((s) => (
                  <li key={s.serviceId ?? "sin-servicio"}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium">{s.name}</span>
                      <span className="shrink-0 font-display font-semibold tabular-nums">{formatMoney(s.billedCents)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${Math.max(4, (s.billedCents / maxBilled) * 100)}%` }}
                        />
                      </div>
                      <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                        {plural(s.attended, "atendido", "atendidos")}
                      </span>
                    </div>
                  </li>
                ))}
                {data.services.length > topServices.length && (
                  <li className="text-xs text-muted-foreground">
                    y {plural(data.services.length - topServices.length, "servicio más", "servicios más")}
                  </li>
                )}
              </ul>
            )}
          </Card>

          <Card
            title="Horarios con más turnos"
            help="Cuántos turnos empezaron en cada hora (sin contar los cancelados). Sirve para ver cuándo sumar horarios o promocionar los huecos."
          >
            {data.peakHours.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">Sin turnos en este período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.peakHours}>
                  <CartesianGrid strokeDasharray="3 3" stroke={c.border} vertical={false} />
                  <XAxis dataKey="hour" stroke={c.muted} fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke={c.muted} fontSize={12} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: c.border, opacity: 0.3 }} />
                  <Bar dataKey="turnos" name="Turnos" fill={c.serving} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card
            title="Clientes nuevos y recurrentes"
            help="De las personas que atendiste en el período: cuántas venían por primera vez y cuántas ya eran clientes."
          >
            {totalClients === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">Todavía no atendiste clientes en este período.</p>
            ) : (
              <div className="flex items-center gap-4">
                <div className="h-[180px] w-[180px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Recurrentes", value: data.newVsReturning.recurrentes },
                          { name: "Nuevos", value: data.newVsReturning.nuevos },
                        ]}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={46}
                        outerRadius={74}
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
                  <LegendRow color={c.accent} label="Recurrentes" value={data.newVsReturning.recurrentes} />
                  <LegendRow color={c.waiting} label="Nuevos" value={data.newVsReturning.nuevos} />
                  <p className="pt-1 text-xs text-muted-foreground">
                    {pct(data.newVsReturning.recurrentes / totalClients)} ya eran clientes
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {!isEmpty && (
        <div className="grid gap-4 lg:grid-cols-2">
          <PaymentMethodsCard data={data} />
          <ChannelsCard data={data} />
          <CancellationsCard data={data} />
          <WaitingRoomCard data={data} />
        </div>
      )}

      <AtRiskCard data={data} filtered={filtered} />
    </div>
  );
}

/* ---------- Cómo te pagaron / cómo llegaron / cancelaciones / sala ---------- */

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo",
  mercadopago: "Mercado Pago",
  transfer: "Transferencia",
};

function PaymentMethodsCard({ data }: { data: MetricsOverviewDto }) {
  const rows = data.byPaymentMethod;
  const total = rows.reduce((acc, r) => acc + r.cents, 0);
  const mp = rows.find((r) => r.method === "mercadopago");
  return (
    <Card
      title="Cómo te pagaron"
      help="Lo cobrado en el período según el medio de pago, sin IVA. Te sirve para cerrar la caja: el efectivo lo tenés vos, Mercado Pago y las transferencias están en tus cuentas."
    >
      {rows.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">No hubo cobros en este período.</p>
      ) : (
        <>
          <ul className="space-y-3">
            {rows.map((r) => (
              <BarRow
                key={r.method}
                label={PAYMENT_METHOD_LABEL[r.method] ?? r.method}
                value={formatMoney(r.cents)}
                sub={plural(r.count, "cobro", "cobros")}
                ratio={total ? r.cents / total : 0}
              />
            ))}
          </ul>
          {mp && mp.vatCents > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Además, tus clientes pagaron {formatMoney(mp.vatCents)} de IVA en Mercado Pago, que cubre la comisión de
              Mercado Pago y no cuenta como ingreso tuyo.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function ChannelsCard({ data }: { data: MetricsOverviewDto }) {
  const ch = data.bookingChannels;
  const total = ch.online + ch.manual + ch.walkIn;
  return (
    <Card
      title="Cómo llegaron los turnos"
      help="Online: el cliente reservó solo con tu link. A mano: lo cargaste vos. Sin turno: llegó y se anotó en la sala de espera."
    >
      {total === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">Sin turnos en este período.</p>
      ) : (
        <>
          <ul className="space-y-3">
            <BarRow label="Online, con tu link" value={String(ch.online)} ratio={ch.online / total} />
            <BarRow label="Cargados a mano" value={String(ch.manual)} ratio={ch.manual / total} />
            {ch.walkIn > 0 && <BarRow label="Llegaron sin turno" value={String(ch.walkIn)} ratio={ch.walkIn / total} />}
          </ul>
          {ch.online > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              {ch.online === 1 ? "1 turno se reservó solo" : `${ch.online} turnos se reservaron solos`} con tu link: menos
              mensajes y llamadas para vos.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

const CANCELLATION_LABEL: Record<string, string> = {
  client: "Los canceló el cliente",
  professional: "Los cancelaste vos",
  bumped: "Los desplazó otra reserva con seña",
  no_show: "Cancelados por ausencia",
  other: "Sin motivo registrado",
};

function CancellationsCard({ data }: { data: MetricsOverviewDto }) {
  const rows = data.cancellationsByReason;
  const total = rows.reduce((acc, r) => acc + r.count, 0);
  return (
    <Card
      title={`Por qué se cancelaron${total > 0 ? ` (${total})` : ""}`}
      help="Turnos cancelados en el período, según quién o qué los canceló. Si muchos los cancela el cliente, pedir seña ayuda a que se comprometa."
    >
      {total === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">No hubo cancelaciones en este período.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <BarRow
              key={r.reason}
              label={CANCELLATION_LABEL[r.reason] ?? r.reason}
              value={String(r.count)}
              ratio={r.count / total}
              tone="cancelled"
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function WaitingRoomCard({ data }: { data: MetricsOverviewDto }) {
  const w = data.waitingRoom;
  return (
    <Card
      title="Sala de espera"
      help="Tiempos reales de quienes pasaron por la sala en el período: cuánto esperaron desde que llegaron hasta que los atendiste y cuánto duró de verdad la atención."
    >
      {w.checkedIn === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">Nadie pasó por la sala de espera en este período.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <MiniStat icon={<Timer className="size-3.5" />} label="Espera promedio" value={minutesLabel(w.avgWaitMinutes)} />
            <MiniStat label="Espera más larga" value={minutesLabel(w.maxWaitMinutes)} />
            <MiniStat label="Duración real de la atención" value={w.avgServiceMinutes ? minutesLabel(w.avgServiceMinutes) : "—"} />
            <MiniStat label="Atendidos que vinieron sin turno" value={String(w.walkInsAttended)} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {plural(w.checkedIn, "persona pasó", "personas pasaron")} por la sala.{" "}
            <Link href="/app/sala" className="font-medium text-accent hover:underline print:hidden">
              Ir a la Sala de espera
            </Link>
          </p>
        </>
      )}
    </Card>
  );
}

function BarRow({
  label,
  value,
  sub,
  ratio,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  ratio: number;
  tone?: "cancelled";
}) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-medium">{label}</span>
        <span className="shrink-0 font-display font-semibold tabular-nums">{value}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", tone === "cancelled" ? "bg-status-cancelled-foreground" : "bg-accent")}
            style={{ width: `${Math.max(3, Math.round(ratio * 100))}%` }}
          />
        </div>
        <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">{sub ?? pct(ratio)}</span>
      </div>
    </li>
  );
}

function MiniStat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <p className="flex items-center gap-1 font-display text-lg font-semibold tabular-nums">
        {icon}
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function minutesLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/* ---------- Resumen en lenguaje simple ---------- */

function Summary({ data, range }: { data: MetricsOverviewDto; range: Range }) {
  const t = data.totals;
  const p = data.previousTotals;
  const when = periodPhrase(range, data.offset, data.period);
  const prevName = range === "week" ? "la semana anterior" : "el mes anterior";
  const sentences: React.ReactNode[] = [];

  if (t.appointments === 0 && t.incomeCents === 0) {
    sentences.push(<>{capitalize(when)} no hubo turnos ni cobros.</>);
  } else {
    const diff = t.attended - p.attended;
    sentences.push(
      <>
        {capitalize(when)} atendiste <b>{plural(t.attended, "persona", "personas")}</b>
        {diff !== 0 && (p.attended > 0 || data.period.isCurrent) ? (
          <> ({diff > 0 ? `${diff} más` : `${-diff} menos`} que {prevName})</>
        ) : null}{" "}
        y cobraste <b>{formatMoney(t.incomeCents)}</b>.
      </>,
    );
    const best = [...data.attendanceByDay].sort((a, b) => b.atendidos - a.atendidos)[0];
    if (best && best.atendidos > 0 && data.attendanceByDay.length > 1) {
      sentences.push(
        <>
          Tu mejor día fue el <b>{format(parseISO(best.date), "EEEE d", { locale: es })}</b>, con{" "}
          {plural(best.atendidos, "atendido", "atendidos")}.
        </>,
      );
    }
    const top = data.services[0];
    if (top && top.billedCents > 0) {
      sentences.push(
        <>
          El servicio que más te dejó fue <b>{top.name}</b> ({formatMoney(top.billedCents)}).
        </>,
      );
    }
    if (t.onlineBookings > 0) {
      sentences.push(
        <>
          {t.onlineBookings === 1 ? "1 turno se reservó solo" : `${t.onlineBookings} turnos se reservaron solos`} con
          tu link.
        </>,
      );
    }
    if (t.noShow > 0) {
      sentences.push(
        <>
          {t.noShow === 1 ? "1 cliente no vino" : `${t.noShow} clientes no vinieron`}
          {data.retainedDeposits.cents > 0 ? (
            <>
              , pero las señas te salvaron <b>{formatMoney(data.retainedDeposits.cents)}</b>
            </>
          ) : null}
          .
        </>,
      );
    }
  }

  return (
    <div className="flex gap-3 rounded-2xl border border-accent/25 bg-accent/5 p-4 break-inside-avoid">
      <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" />
      <p className="text-sm leading-relaxed">
        {sentences.map((s, i) => (
          <span key={i}>
            {s}
            {i < sentences.length - 1 ? " " : ""}
          </span>
        ))}
      </p>
    </div>
  );
}

/* ---------- Clientes que dejaron de venir ---------- */

function AtRiskCard({ data, filtered }: { data: MetricsOverviewDto; filtered: boolean }) {
  const rest = data.atRiskTotal - data.atRiskClients.length;
  return (
    <Card
      title={`Clientes que dejaron de venir${data.atRiskTotal > 0 ? ` (${data.atRiskTotal})` : ""}`}
      help={`Clientes que no atendés hace más de 45 días y que no tienen un turno reservado. Arriba, los que se fueron hace menos: son los más fáciles de recuperar. No depende del período elegido${filtered ? " e incluye clientes de todos tus comercios" : ""}.`}
    >
      {data.atRiskClients.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">¡Todos tus clientes están al día!</p>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {data.atRiskClients.map((cl) => (
              <li key={cl.clientId} className="flex items-center gap-3 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted">
                  <UserMinus className="size-4 text-muted-foreground" />
                </span>
                <Link href={`/app/clientes/${cl.clientId}`} className="min-w-0 flex-1 hover:underline">
                  <span className="block truncate text-sm font-medium">{cl.fullName}</span>
                  <span className="block text-xs text-muted-foreground">
                    Última visita {cl.lastVisitLabel} · {plural(cl.visits, "visita", "visitas")}
                  </span>
                </Link>
                {cl.phone && (
                  <a
                    href={whatsAppLink(cl.phone, reengageMessage(cl.fullName))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted print:hidden"
                  >
                    <MessageCircle className="size-3.5" />
                    <span className="hidden sm:inline">Escribirle</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
          {rest > 0 && (
            <p className="pt-2 text-xs text-muted-foreground">
              y {plural(rest, "cliente más", "clientes más")}.{" "}
              <Link href="/app/clientes" className="font-medium text-accent hover:underline print:hidden">
                Ver clientes
              </Link>
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function reengageMessage(fullName: string) {
  const first = fullName.trim().split(/\s+/)[0] ?? "";
  return `¡Hola ${first}! Hace un tiempo que no te vemos. ¿Querés que te reserve un turno?`;
}

/* ---------- Piezas ---------- */

function EmptyPeriod({ range, isCurrent }: { range: Range; isCurrent: boolean }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border p-8 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-accent/10 text-accent">
        <BarChart3 className="size-5" />
      </span>
      <p className="mt-3 font-display text-base font-semibold">
        {isCurrent ? `Todavía no hay datos ${range === "week" ? "esta semana" : "este mes"}` : "Sin datos en este período"}
      </p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Cuando atiendas turnos, acá vas a ver cuántas personas atendés por día, cuánto cobrás, qué servicios te dejan
        más y en qué horarios tenés más movimiento.
      </p>
    </div>
  );
}

function Card({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 break-inside-avoid">
      <div className="mb-4 flex items-center gap-1.5">
        <h3 className="font-display text-sm font-semibold">{title}</h3>
        {help && <HelpTip text={help} />}
      </div>
      {children}
    </div>
  );
}

function Kpi({
  icon,
  value,
  label,
  sub,
  help,
  delta,
  vs,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  sub?: string;
  help: string;
  delta: React.ReactNode;
  vs: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 break-inside-avoid">
      <div className="flex items-center justify-between">
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-accent/10 text-accent">{icon}</span>
        <HelpTip text={help} align="right" />
      </div>
      <p className="mt-2.5 font-display text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">
        {label}
        {sub && <> · {sub}</>}
      </p>
      {delta && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          {delta}
          <span>{vs}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Variación contra el período anterior. `count`: diferencia absoluta (+3); `percent`:
 * variación relativa (+12%); `points`: diferencia de porcentajes (+4 pts). `invert` para
 * métricas donde bajar es bueno (ausencias).
 */
function Delta({
  current,
  previous,
  kind,
  invert = false,
}: {
  current: number;
  previous: number;
  kind: "count" | "percent" | "points";
  invert?: boolean;
}) {
  const diff = current - previous;
  let text: string;
  if (kind === "points") {
    const pts = Math.round(diff * 100);
    if (pts === 0) return <span className="font-medium">Igual</span>;
    text = `${Math.abs(pts)} pts`;
  } else if (kind === "percent") {
    if (diff === 0) return <span className="font-medium">Igual</span>;
    if (previous === 0) text = "";
    else text = `${Math.abs(Math.round((diff / previous) * 100))}%`;
  } else {
    if (diff === 0) return <span className="font-medium">Igual</span>;
    text = String(Math.abs(diff));
  }
  const up = diff > 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-medium",
        good ? "text-success" : "text-destructive",
      )}
    >
      <Icon className="size-3" />
      {text}
    </span>
  );
}

function MoneyStat({
  label,
  value,
  hint,
  href,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  href?: string;
  tone?: "warning";
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-display text-xl font-semibold tabular-nums", tone === "warning" && "text-warning")}>
        {formatMoney(value)}
      </p>
      <p className="text-xs text-muted-foreground">
        {hint}
        {href && (
          <>
            {" · "}
            <Link href={href} className="font-medium text-accent hover:underline print:hidden">
              Ver en Cierre de caja
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

/** Botón "?" que muestra una explicación corta. Funciona con toque (celular) y teclado. */
function HelpTip({ text, align = "left" }: { text: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex print:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="¿Qué es esto?"
        aria-expanded={open}
        className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <CircleHelp className="size-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className={cn(
            "absolute top-7 z-20 w-64 rounded-lg border border-border bg-popover p-3 text-xs font-normal leading-relaxed text-popover-foreground shadow-md",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {text}
        </span>
      )}
    </span>
  );
}

function ChartLegend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="-mt-2 mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: number }) {
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
  payload?: { name: string; value: number; color: string; payload?: { date?: string } }[];
  label?: string;
  money?: boolean;
}
function ChartTooltip({ active, payload, label, money }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const date = payload[0]?.payload?.date;
  const title = date ? capitalize(format(parseISO(date), "EEEE d 'de' MMMM", { locale: es })) : label;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      {title && <p className="mb-1 font-medium">{title}</p>}
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
    <div className="mt-5 space-y-6">
      <Skeleton className="h-16 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-28 rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-72 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

/* ---------- Textos y formatos ---------- */

function formatHours(minutes: number): string {
  const h = Math.round(minutes / 60);
  return `${h} h`;
}

/** Eje de plata compacto: "$12 mil", "$1,5 M". Los montos vienen en centavos. */
function formatMoneyShort(cents: number): string {
  const pesos = cents / 100;
  if (pesos >= 1_000_000) return `$${(pesos / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`;
  if (pesos >= 1_000) return `$${Math.round(pesos / 1_000)} mil`;
  return `$${Math.round(pesos)}`;
}

/* ---------- Imprimir / PDF ---------- */

/**
 * Imprime la pantalla (el navegador ofrece "Guardar como PDF"). Si está en modo oscuro lo
 * pasa a claro mientras imprime: en papel el fondo no sale y el texto claro no se lee.
 */
function printReport() {
  const root = document.documentElement;
  const wasDark = root.classList.contains("dark");
  if (wasDark) root.classList.remove("dark");
  const restore = () => {
    if (wasDark) root.classList.add("dark");
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
}

/* ---------- Exportar a Excel ---------- */

/**
 * CSV pensado para el Excel en español: separador `;` (la coma es el separador decimal),
 * BOM UTF-8 para que respete los acentos y montos en pesos sin símbolo para que se puedan
 * sumar.
 */
function exportCsv(data: MetricsOverviewDto) {
  const range = data.range as Range;
  const t = data.totals;
  const p = data.previousTotals;
  const pesos = (cents: number) => (cents / 100).toLocaleString("es-AR", { maximumFractionDigits: 2, useGrouping: false });
  const percent = (ratio: number | null | undefined) =>
    ratio == null ? "" : (ratio * 100).toLocaleString("es-AR", { maximumFractionDigits: 1, useGrouping: false });
  const cell = (v: string | number) => {
    const s = String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const row = (...cols: (string | number)[]) => cols.map(cell).join(";");
  const totalsRow = (label: string, get: (x: MetricsTotalsDto) => string | number) => row(label, get(t), get(p));

  const lines = [
    row("Métricas", `${periodTitle(range, data.offset)} — ${periodRangeLabel(data.period, range)}`),
    "",
    row("Resumen", "Este período", "Período anterior"),
    totalsRow("Turnos", (x) => x.appointments),
    totalsRow("Atendidos", (x) => x.attended),
    totalsRow("Cancelados", (x) => x.cancelled),
    totalsRow("No vinieron", (x) => x.noShow),
    totalsRow("Ausencias (%)", (x) => percent(x.noShowRate)),
    totalsRow("Cobrado ($)", (x) => pesos(x.incomeCents)),
    totalsRow("Facturado ($)", (x) => pesos(x.billedCents)),
    totalsRow("Ticket promedio ($)", (x) => pesos(x.averageTicketCents)),
    totalsRow("Agenda ocupada (%)", (x) => percent(x.occupancyRate)),
    totalsRow("Clientes nuevos", (x) => x.newClients),
    totalsRow("Clientes recurrentes", (x) => x.returningClients),
    totalsRow("Reservas online", (x) => x.onlineBookings),
    row("Te deben, a hoy ($)", pesos(data.pending.cashCents)),
    "",
    row("Día", "Atendidos", "Cancelados", "No vinieron", "Cobrado ($)"),
    ...data.attendanceByDay.map((d, i) =>
      row(
        format(parseISO(d.date), "dd/MM/yyyy"),
        d.atendidos,
        d.cancelados,
        d.ausentes,
        pesos(data.incomeByDay[i]?.cents ?? 0),
      ),
    ),
    "",
    row("Servicio", "Atendidos", "Facturado ($)"),
    ...data.services.map((s) => row(s.name, s.attended, pesos(s.billedCents))),
    "",
    row("Medio de pago", "Cobros", "Cobrado ($)", "IVA pagado por el cliente ($)"),
    ...data.byPaymentMethod.map((m) =>
      row(PAYMENT_METHOD_LABEL[m.method] ?? m.method, m.count, pesos(m.cents), pesos(m.vatCents)),
    ),
    "",
    row("Cómo llegaron los turnos", "Cantidad"),
    row("Online, con tu link", data.bookingChannels.online),
    row("Cargados a mano", data.bookingChannels.manual),
    row("Llegaron sin turno", data.bookingChannels.walkIn),
    "",
    row("Motivo de cancelación", "Cantidad"),
    ...data.cancellationsByReason.map((c) => row(CANCELLATION_LABEL[c.reason] ?? c.reason, c.count)),
    "",
    row("Sala de espera", ""),
    row("Pasaron por la sala", data.waitingRoom.checkedIn),
    row("Espera promedio (min)", data.waitingRoom.avgWaitMinutes),
    row("Espera más larga (min)", data.waitingRoom.maxWaitMinutes),
    row("Duración real de la atención (min)", data.waitingRoom.avgServiceMinutes),
    row("Atendidos sin turno", data.waitingRoom.walkInsAttended),
    "",
    row("Señas que te quedaste por ausencias ($)", pesos(data.retainedDeposits.cents)),
  ];

  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `metricas-${data.period.from}-al-${data.period.to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
