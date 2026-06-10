"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  MapPin,
  Clock3,
  LogOut,
  CalendarPlus,
  Eye,
  Ban,
} from "lucide-react";
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
import { AppointmentStatusBadge } from "@/components/appointment-status-badge";
import { useAuth } from "@/components/auth-provider";
import { useMyAppointments, useCancelMyAppointment } from "@/lib/api/me-appointments";
import { AppointmentStatus } from "@/lib/api/generated/model/appointmentStatus";
import { formatDateLong, formatTime } from "@/lib/format";
import type { MyAppointment } from "@/mocks/contract-extensions";

const TERMINAL: AppointmentStatus[] = [
  AppointmentStatus.done,
  AppointmentStatus.no_show,
  AppointmentStatus.cancelled,
];

export function MyAppointmentsView() {
  const { user, logout } = useAuth();
  const { data, isLoading, isError, refetch } = useMyAppointments();

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
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground">
            <CalendarClock className="size-4" />
          </span>
          <span className="font-display text-base font-semibold tracking-tight">
            Costa Turnos
          </span>
        </Link>
        <div className="flex items-center gap-1.5">
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
  appt: MyAppointment;
  past?: boolean;
  onChanged: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const cancel = useCancelMyAppointment();

  // Ventana de cancelación: hasta N horas antes del turno.
  const hoursToStart = (+new Date(appt.startAt) - Date.now()) / 3_600_000;
  const canCancel =
    !past &&
    !TERMINAL.includes(appt.status) &&
    hoursToStart >= appt.business.cancellationWindowHours;

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
          <p className="font-display font-semibold">{appt.business.name}</p>
          <p className="text-sm text-muted-foreground">{appt.serviceName}</p>
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
          <Button variant="outline" size="sm" asChild>
            <Link href={`/r/${appt.business.slug}`}>
              <CalendarPlus className="size-4" />
              Reprogramar
            </Link>
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
      {!past && !canCancel && !TERMINAL.includes(appt.status) && (
        <p className="mt-2 text-xs text-muted-foreground">
          La cancelación online cierra {appt.business.cancellationWindowHours} h antes del
          turno. Si necesitás, contactá al negocio.
        </p>
      )}

      {/* Confirmación de cancelación */}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent sheet={false}>
          <DialogHeader>
            <DialogTitle>¿Cancelar este turno?</DialogTitle>
            <DialogDescription>
              {appt.serviceName} en {appt.business.name},{" "}
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
    </div>
  );
}
