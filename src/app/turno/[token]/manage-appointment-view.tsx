"use client";

import Link from "next/link";
import { ArrowRight, CalendarPlus, CalendarX2, MapPin } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { EmptyState } from "@/components/state-views";
import { useAuth } from "@/components/auth-provider";
import { useAppointmentByToken } from "@/lib/api/me-appointments";
import { AppointmentStatus } from "@/lib/api/generated/model/appointmentStatus";
import { googleCalendarUrl, mapsUrl } from "@/lib/calendar";
import { titleCaseName } from "@/lib/format";
import { AppointmentCard } from "@/app/mis-turnos/my-appointments-view";

const TERMINAL: AppointmentStatus[] = [
  AppointmentStatus.done,
  AppointmentStatus.no_show,
  AppointmentStatus.cancelled,
];

/**
 * "Gestionar mi turno" por link personal (el que llega en el email de confirmación).
 * No pide cuenta: el token de la URL es la credencial. Muestra la misma tarjeta que
 * "Mis turnos", con cancelar y reprogramar dentro de las reglas del negocio.
 */
export function ManageAppointmentView({ token }: { token: string }) {
  const { user } = useAuth();
  const { data: appt, isLoading, isError, refetch } = useAppointmentByToken(token);

  const past = !!appt && (TERMINAL.includes(appt.status) || +new Date(appt.startAt) < Date.now());

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-4 pb-16 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <Logo href="/" size="md" />
        <ThemeToggle />
      </header>

      <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">Tu turno</h1>

      {isLoading && <Skeleton className="mt-6 h-36 w-full rounded-xl" />}

      {isError && (
        <div className="mt-8">
          <EmptyState
            icon={<CalendarX2 className="size-5" />}
            title="No encontramos este turno"
            message="El enlace puede estar incompleto. Abrilo de nuevo desde el email de confirmación."
          />
        </div>
      )}

      {appt && (
        <>
          <div className="mt-6">
            <AppointmentCard
              appt={appt}
              past={past}
              onChanged={() => refetch()}
              manageToken={token}
            />
          </div>

          {!past && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <a
                  href={googleCalendarUrl({
                    title: `${titleCaseName(appt.serviceName)} en ${titleCaseName(appt.business.name)}`,
                    startAt: appt.startAt,
                    endAt: appt.endAt,
                    location: [titleCaseName(appt.business.name), appt.business.address]
                      .filter(Boolean)
                      .join(", "),
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <CalendarPlus className="size-4" />
                  Agregar al calendario
                </a>
              </Button>
              {appt.business.address && (
                <Button variant="outline" size="sm" asChild>
                  <a href={mapsUrl(appt.business.address)} target="_blank" rel="noopener noreferrer">
                    <MapPin className="size-4" />
                    Cómo llegar
                  </a>
                </Button>
              )}
            </div>
          )}

          {past && appt.business.slug && (
            <Button className="mt-4" asChild>
              <Link
                href={
                  appt.serviceId
                    ? `/r/${appt.business.slug}?servicio=${appt.serviceId}&pro=${appt.membershipId}`
                    : `/r/${appt.business.slug}`
                }
              >
                Reservar otro turno <ArrowRight className="size-4" />
              </Link>
            </Button>
          )}

          <p className="mt-8 text-sm text-muted-foreground">
            {user ? (
              <Link href="/mis-turnos" className="font-medium text-accent hover:underline">
                Ver todos mis turnos
              </Link>
            ) : (
              <>
                ¿Reservás seguido?{" "}
                <Link
                  href="/ingresar?registro=cliente&next=%2Fmis-turnos"
                  className="font-medium text-accent hover:underline"
                >
                  Creá tu cuenta
                </Link>{" "}
                y tenés todos tus turnos en un solo lugar.
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
}
