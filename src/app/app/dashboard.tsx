"use client";

import { useMemo } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/state-views";
import { AppointmentStatusBadge } from "@/components/appointment-status-badge";
import { Avatar } from "@/components/avatar";
import { useAuth } from "@/components/auth-provider";
import { useAppointments } from "@/lib/api/appointments";
import { useProfessional } from "@/lib/api/professional";
import { useServices } from "@/lib/api/catalog";
import { useMpStatus } from "@/lib/api/billing";
import { WelcomeSetup } from "@/components/welcome-setup";
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

export function Dashboard() {
  const { user } = useAuth();
  const today = useMemo(() => new Date(), []);
  const range = useMemo(() => dayRange(today), [today]);
  const appts = useAppointments(range);
  const services = useServices();
  const lookupPerson = usePersonLookup();
  const pro = useProfessional();
  const mp = useMpStatus();
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

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-8">
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
                <Link href="/ajustes/pagos" className="font-medium underline underline-offset-2">
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
        </>
      )}
    </div>
  );
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
