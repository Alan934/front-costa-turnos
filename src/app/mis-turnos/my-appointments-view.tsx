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
  ArrowDownUp,
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
import {
  usePublicProfessionalSlots,
  usePublicProfessionalDayAvailability,
} from "@/lib/api/public-booking";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { AppointmentStatus } from "@/lib/api/generated/model/appointmentStatus";
import { formatDateLong, formatTime, titleCaseName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DaySlotPicker } from "@/components/booking/day-slot-picker";
import type { MyAppointmentDto } from "@/lib/api/generated/model/myAppointmentDto";

const TERMINAL: AppointmentStatus[] = [
  AppointmentStatus.done,
  AppointmentStatus.no_show,
  AppointmentStatus.cancelled,
];

/** Un turno es "próximo" si no está en estado terminal y su inicio no pasó todavía. */
function isUpcomingAppt(a: MyAppointmentDto): boolean {
  return !TERMINAL.includes(a.status) && +new Date(a.startAt) >= Date.now();
}

/** Cómo ordena el cliente sus turnos por fecha. Por defecto, del más próximo al más lejano. */
type SortDir = "soonest" | "farthest";
/** Filtro por estado temporal del turno. */
type TimeFilter = "all" | "upcoming" | "past";
/** Cómo se agrupan las tarjetas: por fecha (Próximos/Anteriores) o por negocio. */
type GroupMode = "time" | "business";

export function MyAppointmentsView() {
  const { user, logout } = useAuth();
  const { data, isLoading, isError, isFetching, refetch } = useMyAppointments();

  const [sortDir, setSortDir] = useState<SortDir>("soonest");
  const [filter, setFilter] = useState<TimeFilter>("all");
  const [group, setGroup] = useState<GroupMode>("time");

  const { upcoming, past } = useMemo(() => {
    const list = data ?? [];
    const startAsc = (a: MyAppointmentDto, b: MyAppointmentDto) =>
      +new Date(a.startAt) - +new Date(b.startAt);
    const upcoming = list.filter(isUpcomingAppt);
    const past = list.filter((a) => !isUpcomingAppt(a));
    // "soonest" (default): próximos del más cercano al más lejano; anteriores del más reciente al
    // más viejo. "farthest" invierte ambos.
    upcoming.sort((a, b) => (sortDir === "soonest" ? startAsc(a, b) : -startAsc(a, b)));
    past.sort((a, b) => (sortDir === "soonest" ? -startAsc(a, b) : startAsc(a, b)));
    return { upcoming, past };
  }, [data, sortDir]);

  // Agrupado por negocio: respeta el filtro y el orden ya aplicados a upcoming/past.
  const businessGroups = useMemo(() => {
    const items =
      filter === "upcoming" ? upcoming : filter === "past" ? past : [...upcoming, ...past];
    const map = new Map<string, { name: string; items: MyAppointmentDto[] }>();
    for (const a of items) {
      const key = a.business.slug || a.business.name;
      const g = map.get(key) ?? { name: a.business.name, items: [] };
      g.items.push(a);
      map.set(key, g);
    }
    return Array.from(map.values());
  }, [upcoming, past, filter]);

  const showUpcoming = filter !== "past";
  const showPast = filter !== "upcoming";

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
        data.length === 0 ? (
          <EmptyState
            className="mt-8"
            icon={<CalendarPlus className="size-5" />}
            title="Todavía no tenés turnos"
            message="Cuando reserves en un negocio, lo vas a ver acá."
          />
        ) : (
          <>
            {/* Controles: filtro por estado, orden por fecha y agrupación */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Segmented<TimeFilter>
                options={[
                  { v: "all", label: "Todos" },
                  { v: "upcoming", label: "Próximos" },
                  { v: "past", label: "Anteriores" },
                ]}
                value={filter}
                onChange={setFilter}
              />
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSortDir((d) => (d === "soonest" ? "farthest" : "soonest"))}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  title="Cambiar el orden por fecha"
                >
                  <ArrowDownUp className="size-3.5" />
                  {sortDir === "soonest" ? "Más próximos primero" : "Más lejanos primero"}
                </button>
                <Segmented<GroupMode>
                  options={[
                    { v: "time", label: "Por fecha" },
                    { v: "business", label: "Por negocio" },
                  ]}
                  value={group}
                  onChange={setGroup}
                />
              </div>
            </div>

            {group === "time" ? (
              <div className="mt-6 space-y-8">
                {showUpcoming && (
                  <Section title="Próximos" count={upcoming.length}>
                    {upcoming.length === 0 ? (
                      <EmptyState title="Sin turnos próximos" message="¡Reservá tu próxima visita!" />
                    ) : (
                      upcoming.map((a) => (
                        <AppointmentCard key={a.id} appt={a} onChanged={refetch} />
                      ))
                    )}
                  </Section>
                )}
                {showPast && (past.length > 0 || filter === "past") && (
                  <Section title="Anteriores" count={past.length}>
                    {past.length === 0 ? (
                      <EmptyState title="Sin turnos anteriores" message="Acá vas a ver tu historial." />
                    ) : (
                      past.map((a) => (
                        <AppointmentCard key={a.id} appt={a} past onChanged={refetch} />
                      ))
                    )}
                  </Section>
                )}
              </div>
            ) : (
              <div className="mt-6 space-y-8">
                {businessGroups.length === 0 ? (
                  <EmptyState
                    icon={<CalendarX2 className="size-5" />}
                    title="Sin turnos para mostrar"
                    message="Probá con otro filtro."
                  />
                ) : (
                  businessGroups.map((g) => (
                    <Section key={g.name} title={titleCaseName(g.name)} count={g.items.length}>
                      {g.items.map((a) => (
                        <AppointmentCard
                          key={a.id}
                          appt={a}
                          past={!isUpcomingAppt(a)}
                          onChanged={refetch}
                        />
                      ))}
                    </Section>
                  ))
                )}
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}

/** Grupo de pills de selección única (filtro / agrupación). Estilo segmented. */
function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { v: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v ? "true" : "false"}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            value === o.v
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
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

  // Solo pedimos slots/disponibilidad mientras el diálogo está abierto.
  const slotsParams = open ? { serviceId: appt.serviceId, from: range.from, to: range.to } : null;
  const { data: slots, isLoading, isError, refetch } = usePublicProfessionalSlots(
    appt.business.slug,
    appt.membershipId,
    slotsParams,
  );
  // Disponibilidad por día (mismo origen que la página pública): colorea los días, marca cuántos
  // turnos quedan y deshabilita los que el profesional no atiende ese servicio.
  const { data: availability } = usePublicProfessionalDayAvailability(
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
          <DaySlotPicker
            days={days}
            slots={slots}
            availability={availability}
            activeDay={activeDay}
            onActiveDayChange={setActiveDay}
            onPickSlot={(slot) => pick(slot.startAt)}
            isLoading={isLoading}
            isError={isError}
            onRetry={() => refetch()}
            excludeStartAt={appt.startAt}
            pickDisabled={reschedule.isPending}
          />

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
