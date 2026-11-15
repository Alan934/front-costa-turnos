"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Clock3,
  TriangleAlert,
  Radio,
  DollarSign,
  ArrowRight,
  CheckCircle2,
  Wallet,
  BellRing,
  CalendarPlus,
  CalendarX2,
  Hourglass,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/state-views";
import { AppointmentStatusBadge } from "@/components/appointment-status-badge";
import { RefreshButton } from "@/components/refresh-button";
import { Avatar } from "@/components/avatar";
import { useAuth } from "@/components/auth-provider";
import { useAppointments } from "@/lib/api/appointments";
import { useProfessional } from "@/lib/api/professional";
import { useServices } from "@/lib/api/catalog";
import { useMpStatus } from "@/lib/api/billing";
import { useWaitlistList } from "@/lib/api/generated/endpoints/waitlist/waitlist";
import { WelcomeSetup } from "@/components/welcome-setup";
import { ComercioWelcomeBanner } from "./comercio-welcome-banner";
import { FreeGapsCard } from "./free-gaps-card";
import { PublicPageLink } from "@/components/public-page-link";
import { usePersonLookup } from "@/lib/api/clients";
import { dayRange, isSameLocalDay } from "@/lib/agenda";
import { AppointmentStatus } from "@/lib/api/generated/model/appointmentStatus";
import { formatMoney, formatTime, titleCaseName } from "@/lib/format";
import type { Appointment } from "@/lib/api/generated/model/appointment";
import type { PublicPageBranding } from "@/mocks/contract-extensions";

const ACTIVE: AppointmentStatus[] = [
  AppointmentStatus.requested,
  AppointmentStatus.confirmed,
  AppointmentStatus.in_progress,
];

/** Máximo de novedades listadas de cada tipo; el resto se resume en una línea. */
const NEWS_MAX = 5;

export function Dashboard() {
  const { user } = useAuth();
  const today = useMemo(() => new Date(), []);
  const range = useMemo(() => dayRange(today), [today]);
  const appts = useAppointments(range);
  const services = useServices();
  const lookupPerson = usePersonLookup();
  const pro = useProfessional();
  const mp = useMpStatus();
  const waitlist = useWaitlistList();
  const waitingCount = (waitlist.data ?? []).filter((w) => w.status === "waiting").length;
  const logoFileId = (pro.data?.publicPageSettings as PublicPageBranding | undefined)?.logoFileId;

  const todays = (appts.data ?? []).filter((a) => isSameLocalDay(new Date(a.startAt), today));
  const priceOf = (a: Appointment) =>
    services.data?.find((s) => s.id === a.serviceId)?.priceCents ?? 0;

  const upcoming = todays
    .filter((a) => ACTIVE.includes(a.status))
    .sort((x, y) => +new Date(x.startAt) - +new Date(y.startAt));
  const inProgress = todays.filter((a) => a.status === AppointmentStatus.in_progress).length;
  const done = todays.filter((a) => a.status === AppointmentStatus.done).length;
  const estIncome = todays
    .filter((a) => a.status !== AppointmentStatus.cancelled && a.status !== AppointmentStatus.no_show)
    .reduce((s, a) => s + priceOf(a), 0);
  const provisional = todays.filter((a) => a.isProvisional && ACTIVE.includes(a.status));
  const mpNotConnected = !mp.isLoading && mp.data?.connected === false;
  const hasPaidServices = (services.data ?? []).some((s) => s.allowDeposit || s.allowFullPayment);

  const loading = appts.isLoading || services.isLoading;

  // ---- Próximos 7 días (desde mañana) ----
  const nextRange = useMemo(() => {
    const from = new Date(today);
    from.setDate(from.getDate() + 1);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 6);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [today]);
  const nextAppts = useAppointments(nextRange);
  const nextDays = useMemo(() => {
    const from = +new Date(nextRange.from);
    const to = +new Date(nextRange.to);
    const byDay = new Map<string, Appointment[]>();
    for (const a of nextAppts.data ?? []) {
      const t = +new Date(a.startAt);
      if (t < from || t > to || !ACTIVE.includes(a.status)) continue;
      const key = new Date(a.startAt).toDateString();
      byDay.set(key, [...(byDay.get(key) ?? []), a]);
    }
    return [...byDay.values()]
      .map((list) => list.sort((x, y) => +new Date(x.startAt) - +new Date(y.startAt)))
      .sort((x, y) => +new Date(x[0].startAt) - +new Date(y[0].startAt));
  }, [nextAppts.data, nextRange]);

  // ---- Novedades desde la última visita: reservas y cancelaciones hechas por clientes ----
  const seenKey = user ? `costa-dash-seen:${user.id}` : null;
  const [since, setSince] = useState<number | null>(null);
  useEffect(() => {
    if (!seenKey) return;
    const floor = Date.now() - 7 * 24 * 3_600_000; // nunca más de una semana hacia atrás
    let stored = NaN;
    try {
      stored = Number(localStorage.getItem(seenKey));
    } catch {
      // sin almacenamiento: se usa el valor por defecto
    }
    // Primera vez en este dispositivo: mostramos lo de las últimas 24 h.
    setSince(Math.max(Number.isFinite(stored) && stored > 0 ? stored : Date.now() - 86_400_000, floor));
  }, [seenKey]);

  const news = useMemo(() => {
    if (since == null) return { booked: [] as Appointment[], cancelled: [] as Appointment[] };
    const all = [...(appts.data ?? []), ...(nextAppts.data ?? [])];
    const unique = [...new Map(all.map((a) => [a.id, a])).values()];
    const upcomingOnly = unique.filter((a) => +new Date(a.startAt) > Date.now());
    return {
      booked: upcomingOnly.filter(
        (a) =>
          a.createdVia === "client_self" &&
          ACTIVE.includes(a.status) &&
          +new Date(a.createdAt) > since,
      ),
      cancelled: upcomingOnly.filter(
        (a) =>
          a.status === AppointmentStatus.cancelled &&
          a.cancellationReason === "client" &&
          +new Date(a.updatedAt) > since,
      ),
    };
  }, [appts.data, nextAppts.data, since]);

  function markNewsSeen() {
    const now = Date.now();
    setSince(now);
    try {
      if (seenKey) localStorage.setItem(seenKey, String(now));
    } catch {
      // idem
    }
  }

  const serviceName = (a: Appointment) =>
    titleCaseName(a.serviceName ?? services.data?.find((s) => s.id === a.serviceId)?.name ?? "") ||
    "Servicio";

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-8">
      <Suspense fallback={null}>
        <ComercioWelcomeBanner />
      </Suspense>
      <WelcomeSetup />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={user?.fullName} fileId={logoFileId} className="size-11" />
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Hola{user?.fullName ? `, ${user.fullName.split(" ")[0]}` : ""} 👋
            </h1>
            <p className="text-sm capitalize text-muted-foreground">{formatTodayLabel(today)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <RefreshButton fetching={appts.isFetching} onClick={() => appts.refetch()} />
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/sala">
              <Radio className="size-4" />
              Sala
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/app/agenda">
              <CalendarDays className="size-4" />
              Agenda
            </Link>
          </Button>
        </div>
      </div>

      {pro.data?.slug && (
        <div className="mt-5">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Compartí tu página de reservas
          </p>
          <PublicPageLink slug={pro.data.slug} businessName={pro.data.businessName} share />
        </div>
      )}

      {appts.isError ? (
        <ErrorState className="mt-6" message="No pudimos cargar tu día." onRetry={() => appts.refetch()} />
      ) : (
        <>
          {/* KPIs */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi loading={loading} icon={<CalendarDays className="size-4" />} value={String(todays.length)} label="turnos hoy" />
            <Kpi loading={loading} icon={<CheckCircle2 className="size-4" />} value={String(done)} label="atendidos" tone="done" />
            <Kpi loading={loading} icon={<Radio className="size-4" />} value={String(inProgress)} label="en atención" tone="serving" />
            <Kpi loading={loading} icon={<DollarSign className="size-4" />} value={formatMoney(estIncome)} label="estimado" />
          </div>

          {/* Alertas */}
          {mpNotConnected && hasPaidServices && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3.5">
              <Wallet className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
              <p className="text-sm text-warning-foreground">
                Tenés servicios configurados con cobro online (seña o pago completo), pero{" "}
                <strong>MercadoPago no está conectado</strong>. Esas opciones no estarán
                disponibles para tus clientes hasta que lo conectes.{" "}
                <Link href="/app/cobros" className="font-medium underline underline-offset-2">
                  Conectar cobros
                </Link>
                .
              </p>
            </div>
          )}
          {provisional.length > 0 && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3.5">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
              <p className="text-sm text-warning-foreground">
                Tenés <strong>{provisional.length}</strong> turno{provisional.length > 1 ? "s" : ""}{" "}
                provisional{provisional.length > 1 ? "es" : ""} sin seña hoy. Pueden ser tomados por quien abone.
              </p>
            </div>
          )}
          {waitingCount > 0 && (
            <Link
              href="/app/lista-espera"
              className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-accent"
            >
              <Hourglass className="size-4 shrink-0 text-accent" />
              <p className="flex-1 text-sm">
                <strong>{waitingCount}</strong>{" "}
                {waitingCount === 1 ? "persona espera" : "personas esperan"} que se libere un
                lugar en un día completo. Si tenés un hueco, podés {waitingCount === 1 ? "darle" : "darles"}{" "}
                turno.
              </p>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          )}

          {/* Huecos libres de hoy y mañana, para compartir */}
          <FreeGapsCard />

          {/* Novedades desde la última visita */}
          {(news.booked.length > 0 || news.cancelled.length > 0) && (
            <section className="mt-6 rounded-2xl border border-accent/30 bg-accent/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="inline-flex items-center gap-2 font-display text-sm font-semibold">
                  <BellRing className="size-4 text-accent" />
                  Novedades desde tu última visita
                </h2>
                <Button variant="ghost" size="sm" onClick={markNewsSeen}>
                  Listo, ya las vi
                </Button>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {news.booked.slice(0, NEWS_MAX).map((a) => (
                  <li key={a.id} className="flex items-start gap-2">
                    <CalendarPlus className="mt-0.5 size-4 shrink-0 text-success" />
                    <span>
                      <span className="font-medium">
                        {lookupPerson(a.personId, { name: a.personName }).name}
                      </span>{" "}
                      reservó {serviceName(a)} para el {formatDayAndTime(a.startAt)}.
                    </span>
                  </li>
                ))}
                {news.cancelled.slice(0, NEWS_MAX).map((a) => (
                  <li key={a.id} className="flex items-start gap-2">
                    <CalendarX2 className="mt-0.5 size-4 shrink-0 text-destructive" />
                    <span>
                      <span className="font-medium">
                        {lookupPerson(a.personId, { name: a.personName }).name}
                      </span>{" "}
                      canceló su turno del {formatDayAndTime(a.startAt)}. El horario quedó libre.
                    </span>
                  </li>
                ))}
              </ul>
              {(news.booked.length > NEWS_MAX || news.cancelled.length > NEWS_MAX) && (
                <p className="mt-2 text-xs text-muted-foreground">
                  En total: {news.booked.length} reserva{news.booked.length === 1 ? "" : "s"} nueva
                  {news.booked.length === 1 ? "" : "s"} y {news.cancelled.length} cancelaci
                  {news.cancelled.length === 1 ? "ón" : "ones"}.{" "}
                  <Link href="/app/agenda" className="font-medium text-accent hover:underline">
                    Ver todo en la agenda
                  </Link>
                </p>
              )}
            </section>
          )}

          {/* Próximos turnos */}
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-muted-foreground">Próximos turnos de hoy</h2>
              <Link href="/app/agenda" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
                Ver agenda
                <ArrowRight className="size-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : upcoming.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="size-5" />}
                title="No quedan turnos por hoy"
                message="Disfrutá el resto del día o cargá uno nuevo."
                action={
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/app/agenda">Ir a la agenda</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-2">
                {upcoming.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock3 className="size-3.5" />
                      <span className="font-display text-sm font-semibold tabular-nums">{formatTime(a.startAt)}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{lookupPerson(a.personId, { name: a.personName }).name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {titleCaseName(a.serviceName ?? services.data?.find((s) => s.id === a.serviceId)?.name ?? "") || "Servicio"}
                      </p>
                    </div>
                    <AppointmentStatusBadge status={a.status} isProvisional={a.isProvisional} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Próximos días: para planificar sin entrar a la agenda */}
          <section className="mt-8">
            <h2 className="mb-3 font-display text-sm font-semibold text-muted-foreground">
              Próximos 7 días
            </h2>
            {nextAppts.isLoading ? (
              <Skeleton className="h-16 w-full rounded-xl" />
            ) : nextAppts.isError ? (
              <p className="text-sm text-muted-foreground">No pudimos cargar los próximos días.</p>
            ) : nextDays.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Todavía no tenés turnos para los próximos días. Compartí tu página de reservas
                para que te empiecen a llegar.
              </p>
            ) : (
              <ul className="space-y-2">
                {nextDays.map((list) => (
                  <li key={list[0].id}>
                    <Link
                      href="/app/agenda"
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-accent/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium capitalize">
                          {formatDayLabel(list[0].startAt, today)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {list
                            .slice(0, 3)
                            .map(
                              (a) =>
                                `${formatTime(a.startAt)} ${lookupPerson(a.personId, { name: a.personName }).name}`,
                            )
                            .join(" · ")}
                          {list.length > 3 ? ` · y ${list.length - 3} más` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                        {list.length} turno{list.length === 1 ? "" : "s"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/** "Mañana", o "viernes 20" para los días siguientes. */
function formatDayLabel(iso: string, today: Date): string {
  const d = new Date(iso);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameLocalDay(d, tomorrow)) return "Mañana";
  return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric" }).format(d);
}

/** "viernes 20 a las 10:30" (para las novedades). */
function formatDayAndTime(iso: string): string {
  const day = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric" }).format(
    new Date(iso),
  );
  return `${day} a las ${formatTime(iso)}`;
}

function Kpi({
  icon,
  value,
  label,
  tone,
  loading,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  tone?: "done" | "serving";
  loading?: boolean;
}) {
  if (loading) return <Skeleton className="h-24 rounded-2xl" />;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <span
        className={
          tone === "serving"
            ? "inline-flex size-8 items-center justify-center rounded-lg bg-status-serving text-status-serving-foreground"
            : tone === "done"
              ? "inline-flex size-8 items-center justify-center rounded-lg bg-status-done text-status-done-foreground"
              : "inline-flex size-8 items-center justify-center rounded-lg bg-accent/10 text-accent"
        }
      >
        {icon}
      </span>
      <p className="mt-2.5 font-display text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function formatTodayLabel(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(d);
}
