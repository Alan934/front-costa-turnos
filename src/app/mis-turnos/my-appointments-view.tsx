"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  MapPin,
  Clock3,
  LogOut,
  CalendarPlus,
  CalendarClock,
  CalendarX2,
  Eye,
  Ban,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { ErrorState, EmptyState } from "@/components/state-views";
import { RefreshButton } from "@/components/refresh-button";
import { AppointmentStatusBadge } from "@/components/appointment-status-badge";
import { useAuth } from "@/components/auth-provider";
import {
  useMyAppointments,
  useCancelMyAppointment,
  useRescheduleMyAppointment,
} from "@/lib/api/me-appointments";
import { usePublicProfessionalSlots } from "@/lib/api/public-booking";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { AppointmentStatus } from "@/lib/api/generated/model/appointmentStatus";
import {
  formatDateLong,
  formatTime,
  formatDayChip,
  isSameDay,
  titleCaseName,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MyAppointmentDto } from "@/lib/api/generated/model/myAppointmentDto";

const TERMINAL: AppointmentStatus[] = [
  AppointmentStatus.done,
  AppointmentStatus.no_show,
  AppointmentStatus.cancelled,
];

export function MyAppointmentsView() {
  const { user, logout } = useAuth();
  const { data, isLoading, isError, isFetching, refetch } = useMyAppointments();

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const list = data ?? [];
    const upcoming = list.filter(
      (a) => !TERMINAL.includes(a.status) && +new Date(a.startAt) >= now,
    );
    const past = list.filter(
      (a) => TERMINAL.includes(a.status) || +new Date(a.startAt) < now,
    );
    return { upcoming, past };
  }, [data]);

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-16 sm:px-6">
      {/* Topbar */}
      <header className="flex items-center justify-between py-5">
        <Logo href="/" size="md" />
        <div className="flex items-center gap-1.5">
          <RefreshButton fetching={isFetching} onClick={() => refetch()} />
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={() => logout()}>
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </header>

      <div className="mt-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Mis turnos</h1>
        <p className="text-sm text-muted-foreground">
          Hola{user?.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}. Acá están tus
          reservas en todos los negocios.
        </p>
      </div>

      {isLoading && (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && (
        <div className="mt-6">
          <ErrorState message="No pudimos cargar tus turnos." onRetry={() => refetch()} />
        </div>
      )}

      {data && (
        <>
          {data.length === 0 ? (
            <EmptyState
              className="mt-8"
              icon={<CalendarPlus className="size-5" />}
              title="Todavía no tenés turnos"
              message="Cuando reserves en un negocio, lo vas a ver acá."
            />
          ) : (
            <div className="mt-6 space-y-8">
              <Section title="Próximos" count={upcoming.length}>
                {upcoming.length === 0 ? (
                  <EmptyState title="Sin turnos próximos" message="¡Reservá tu próxima visita!" />
                ) : (
                  upcoming.map((a) => (
                    <AppointmentCard key={a.id} appt={a} onChanged={refetch} />
                  ))
                )}
              </Section>

              {past.length > 0 && (
                <Section title="Anteriores" count={past.length}>
                  {past.map((a) => (
                    <AppointmentCard key={a.id} appt={a} past onChanged={refetch} />
                  ))}
                </Section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-muted-foreground">
        {title}
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">{count}</span>
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function AppointmentCard({
  appt,
  past,
  onChanged,
}: {
  appt: MyAppointmentDto;
  past?: boolean;
  onChanged: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const cancel = useCancelMyAppointment();

  // Ventana de cancelación / reprogramación: hasta N horas antes del turno.
  const hoursToStart = (+new Date(appt.startAt) - Date.now()) / 3_600_000;
  const active = !past && !TERMINAL.includes(appt.status);
  const canCancel = active && hoursToStart >= appt.business.cancellationWindowHours;
  const canReschedule = active && hoursToStart >= appt.business.rescheduleWindowHours;

  function doCancel() {
    cancel.mutate(appt.id, {
      onSuccess: () => {
        setConfirming(false);
        onChanged();
      },
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display font-semibold">{titleCaseName(appt.business.name)}</p>
          <p className="text-sm text-muted-foreground">{titleCaseName(appt.serviceName)}</p>
        </div>
        <AppointmentStatusBadge status={appt.status} isProvisional={appt.isProvisional} />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="size-3.5 text-accent" />
          <span className="capitalize text-foreground">
            {formatDateLong(appt.startAt)} · {formatTime(appt.startAt)}
          </span>
        </span>
        {appt.business.address && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5 text-accent" />
            {appt.business.address}
          </span>
        )}
      </div>

      {appt.isProvisional && !past && (
        <p className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-xs text-warning-foreground">
          Turno provisional: sin seña, puede ser tomado por quien abone. Pagá la seña para
          asegurarlo.
        </p>
      )}

      {!past && (
        <div className="mt-4 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRescheduling(true)}
            disabled={!canReschedule}
            title={
              canReschedule
                ? undefined
                : `Se puede reprogramar hasta ${appt.business.rescheduleWindowHours} h antes`
            }
          >
            <CalendarClock className="size-4" />
            Reprogramar
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/sala/${appt.id}`}>
              <Eye className="size-4" />
              Ver sala
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-destructive hover:bg-destructive/10"
            onClick={() => setConfirming(true)}
            disabled={!canCancel}
            title={
              canCancel
                ? undefined
                : `Se puede cancelar hasta ${appt.business.cancellationWindowHours} h antes`
            }
          >
            <Ban className="size-4" />
            Cancelar
          </Button>
        </div>
      )}
      {active && !(canCancel && canReschedule) && (
        <p className="mt-2 text-xs text-muted-foreground">
          {!canCancel && !canReschedule
            ? `La cancelación cierra ${appt.business.cancellationWindowHours} h antes y la reprogramación ${appt.business.rescheduleWindowHours} h antes del turno. Si necesitás, contactá al negocio.`
            : !canCancel
              ? `La cancelación online cierra ${appt.business.cancellationWindowHours} h antes del turno. Si necesitás, contactá al negocio.`
              : `La reprogramación online cierra ${appt.business.rescheduleWindowHours} h antes del turno. Si necesitás, contactá al negocio.`}
        </p>
      )}

      {/* Confirmación de cancelación */}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent sheet={false}>
          <DialogHeader>
            <DialogTitle>¿Cancelar este turno?</DialogTitle>
            <DialogDescription>
              {titleCaseName(appt.serviceName)} en {titleCaseName(appt.business.name)},{" "}
              {formatDateLong(appt.startAt)} a las {formatTime(appt.startAt)}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 p-6 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirming(false)}>
              No, mantener
            </Button>
            <Button
              className="flex-1 bg-destructive text-destructive-foreground hover:brightness-105"
              onClick={doCancel}
              disabled={cancel.isPending}
            >
              {cancel.isPending ? <Spinner /> : null}
              Sí, cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reprogramación: elegir nuevo horario con el mismo profesional y servicio */}
      <RescheduleDialog
        appt={appt}
        open={rescheduling}
        onOpenChange={setRescheduling}
        onDone={onChanged}
      />
    </div>
  );
}

/**
 * Reprograma un turno al MISMO profesional y servicio: lista los slots disponibles (de la página
 * pública del comercio) y, al elegir uno, llama a `POST /me/appointments/:id/reschedule`. El back
 * vuelve a validar la ventana de reprogramación y la anticipación mínima sobre el nuevo horario.
 */
function RescheduleDialog({
  appt,
  open,
  onOpenChange,
  onDone,
}: {
  appt: MyAppointmentDto;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  // Próximos 14 días como opciones de fecha.
  const days = useMemo(() => {
    const out: Date[] = [];
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i++) {
      const day = new Date(d);
      day.setDate(d.getDate() + i);
      out.push(day);
    }
    return out;
  }, []);

  const [activeDay, setActiveDay] = useState<Date>(days[0]);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => {
    const from = new Date(days[0]);
    const to = new Date(days[days.length - 1]);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [days]);

  // Solo pedimos slots mientras el diálogo está abierto.
  const slotsParams = open ? { serviceId: appt.serviceId, from: range.from, to: range.to } : null;
  const { data: slots, isLoading, isError, refetch } = usePublicProfessionalSlots(
    appt.business.slug,
    appt.membershipId,
    slotsParams,
  );

  const reschedule = useRescheduleMyAppointment();

  // Al cerrar, reseteamos el estado local para no arrastrar errores ni el día activo.
  useEffect(() => {
    if (!open) {
      setError(null);
      setActiveDay(days[0]);
    }
  }, [open, days]);

  // Excluimos el horario actual del turno: reprogramar al mismo instante no tiene sentido.
  const daySlots = (slots ?? []).filter(
    (s) => isSameDay(s.startAt, activeDay) && s.startAt !== appt.startAt,
  );

  function pick(startAt: string) {
    setError(null);
    reschedule.mutate(
      { id: appt.id, startAt },
      {
        onSuccess: () => {
          onOpenChange(false);
          onDone();
        },
        onError: (err) => {
          // 409: el back rechazó por ventana / solape / anticipación mínima.
          setError(
            getApiErrorMessage(err, "No pudimos reprogramar el turno. Probá con otro horario."),
          );
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent sheet={false}>
        <DialogHeader>
          <DialogTitle>Reprogramar turno</DialogTitle>
          <DialogDescription>
            {titleCaseName(appt.serviceName)} con {titleCaseName(appt.staffName)}. Elegí un nuevo
            día y horario.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 pt-2">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {days.map((d) => {
              const chip = formatDayChip(d);
              const isActive = isSameDay(d, activeDay);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => setActiveDay(d)}
                  className={cn(
                    "flex shrink-0 flex-col items-center rounded-xl border px-3.5 py-2.5 transition-colors",
                    isActive
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted-foreground hover:border-accent/50",
                  )}
                >
                  <span className="text-[11px] uppercase">{chip.weekday}</span>
                  <span className="font-display text-base font-semibold tabular-nums">
                    {chip.day}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            {isLoading && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded-lg" />
                ))}
              </div>
            )}
            {isError && (
              <ErrorState message="No pudimos cargar los horarios." onRetry={() => refetch()} />
            )}
            {!isLoading && !isError && daySlots.length === 0 && (
              <EmptyState
                icon={<CalendarX2 className="size-5" />}
                title="Sin horarios este día"
                message="Probá con otra fecha de la lista."
              />
            )}
            {!isLoading && !isError && daySlots.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {daySlots.map((slot) => (
                  <button
                    key={slot.startAt}
                    type="button"
                    onClick={() => pick(slot.startAt)}
                    disabled={reschedule.isPending}
                    className="rounded-lg border border-border py-2.5 font-display text-sm font-medium tabular-nums transition-colors hover:border-accent hover:bg-accent/10 hover:text-accent focus-visible:border-accent disabled:opacity-50"
                  >
                    {formatTime(slot.startAt)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {reschedule.isPending && (
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner /> Reprogramando…
            </p>
          )}
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
