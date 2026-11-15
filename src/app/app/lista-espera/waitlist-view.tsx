"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarPlus,
  Check,
  Hourglass,
  Mail,
  MessageCircle,
  Phone,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState, EmptyState, SkeletonList } from "@/components/state-views";
import {
  getWaitlistListQueryKey,
  useWaitlistList,
  useWaitlistNotify,
  useWaitlistRemove,
} from "@/lib/api/generated/endpoints/waitlist/waitlist";
import type { WaitlistItemDto } from "@/lib/api/generated/model/waitlistItemDto";
import type { Staff } from "@/lib/api/generated/model/staff";
import { useProfessionalsListStaff } from "@/lib/api/generated/endpoints/professionals/professionals";
import { useServices } from "@/lib/api/catalog";
import { useProfessional } from "@/lib/api/professional";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { formatDateLong, formatDateShort, isSameDay, titleCaseName } from "@/lib/format";
import { whatsAppLink } from "@/lib/whatsapp";
import { NewAppointmentDialog } from "../agenda/new-appointment-dialog";

/**
 * Mediodía del día pedido. `desiredFrom` es la medianoche en la zona del negocio: usar el
 * mediodía evita que un desfase de zona horaria lo corra al día anterior.
 */
function dayOf(item: WaitlistItemDto): Date {
  return new Date(new Date(item.desiredFrom).getTime() + 12 * 3_600_000);
}

function dayLabel(day: Date): string {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 3_600_000);
  if (isSameDay(day, today)) return "Hoy";
  if (isSameDay(day, tomorrow)) return "Mañana";
  // "martes 18 de noviembre de 2026" → "Martes 18 de noviembre" (el año sobra: son días próximos).
  const text = formatDateLong(day).replace(/ de \d{4}$/, "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Lista de espera: clientes que quisieron turno en un día que estaba completo y dejaron su
 * contacto desde la página pública. Si se libera un horario el sistema les avisa solo por
 * email; acá el profesional ve quiénes son y puede darles turno él mismo (por ejemplo, un
 * sobreturno) o escribirles por WhatsApp.
 */
export function WaitlistView() {
  const qc = useQueryClient();
  const list = useWaitlistList();
  const staffQuery = useProfessionalsListStaff();
  const servicesQuery = useServices();
  const pro = useProfessional();
  const [booking, setBooking] = useState<WaitlistItemDto | null>(null);
  const [bookedName, setBookedName] = useState<string | null>(null);

  const staffList = (staffQuery.data ?? [])
    .filter((s: Staff) => s.isActive)
    .map((s: Staff) => ({ ...s, displayName: titleCaseName(s.displayName) }));
  const services = (servicesQuery.data ?? [])
    .filter((s) => s.isActive)
    .map((s) => ({ ...s, name: titleCaseName(s.name) }));

  const groups = useMemo(() => {
    const byDay = new Map<string, { day: Date; items: WaitlistItemDto[] }>();
    for (const item of list.data ?? []) {
      const day = dayOf(item);
      const key = formatDateShort(day);
      const group = byDay.get(key) ?? { day, items: [] };
      group.items.push(item);
      byDay.set(key, group);
    }
    return [...byDay.values()];
  }, [list.data]);

  const refresh = () => qc.invalidateQueries({ queryKey: getWaitlistListQueryKey() });
  const total = list.data?.length ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Lista de espera</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Clientes que quisieron turno en un día completo. Si se libera un horario les avisamos
          solos por email; desde acá también podés darles turno vos o escribirles.
        </p>
      </div>

      {bookedName && (
        <div
          role="status"
          className="mt-5 flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm"
        >
          <Check className="size-4 shrink-0 text-success" />
          <span className="flex-1">
            Listo: le diste turno a {bookedName} y salió de la lista de espera.
          </span>
          <button
            type="button"
            onClick={() => setBookedName(null)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Cerrar
          </button>
        </div>
      )}

      <div className="mt-5">
        {list.isLoading ? (
          <SkeletonList rows={3} />
        ) : list.isError ? (
          <ErrorState
            message="No pudimos cargar la lista de espera."
            onRetry={() => list.refetch()}
          />
        ) : total === 0 ? (
          <EmptyState
            icon={<Hourglass className="size-6" />}
            title="Nadie en lista de espera"
            message="Cuando un día se llena, tus clientes pueden anotarse desde tu página para que les avisemos si se libera un lugar. Van a aparecer acá."
          />
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <section key={g.day.toISOString()}>
                <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold">
                  {dayLabel(g.day)}
                  <span className="text-xs font-normal text-muted-foreground">
                    {g.items.length === 1 ? "1 persona" : `${g.items.length} personas`}
                  </span>
                </h2>
                <ul className="space-y-2">
                  {g.items.map((item) => (
                    <WaitlistRow
                      key={item.id}
                      item={item}
                      day={g.day}
                      businessName={pro.data?.businessName}
                      canBook={staffList.length > 0 && services.length > 0}
                      onBook={() => setBooking(item)}
                      onChanged={refresh}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      {booking && (
        <NewAppointmentDialog
          date={dayOf(booking)}
          staff={staffList}
          services={services}
          initialClient={{
            personId: booking.personId,
            fullName: booking.fullName,
            phone: booking.phone ?? undefined,
          }}
          initialServiceId={booking.serviceId}
          onClose={() => setBooking(null)}
          onCreated={() => {
            setBookedName(titleCaseName(booking.fullName));
            setBooking(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function WaitlistRow({
  item,
  day,
  businessName,
  canBook,
  onBook,
  onChanged,
}: {
  item: WaitlistItemDto;
  day: Date;
  businessName?: string;
  canBook: boolean;
  onBook: () => void;
  onChanged: () => void;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const notify = useWaitlistNotify({ mutation: { onSuccess: onChanged } });
  const remove = useWaitlistRemove({ mutation: { onSuccess: onChanged } });

  const name = titleCaseName(item.fullName) || "Cliente";
  const firstName = name.split(" ")[0];
  const notified = item.status === "notified";
  const when = dayLabel(day);
  const whatsappText =
    `¡Hola ${firstName}! Te escribo${businessName ? ` de ${businessName}` : ""}: ` +
    `se liberó un lugar ${when === "Hoy" || when === "Mañana" ? when.toLowerCase() : `el ${when.toLowerCase()}`}` +
    `${item.serviceName ? ` para ${item.serviceName.toLowerCase()}` : ""}. ¿Te lo reservo?`;

  const error = notify.isError
    ? getApiErrorMessage(notify.error)
    : remove.isError
      ? getApiErrorMessage(remove.error)
      : null;

  return (
    <li className="rounded-xl border border-border bg-card p-3.5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted font-display text-sm font-semibold">
          {name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium">{name}</p>
            {notified && <Badge variant="muted">Ya le avisamos</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            {item.serviceName ? titleCaseName(item.serviceName) : "Cualquier servicio"}
            {" · "}se anotó el {formatDateShort(item.createdAt)}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {item.phone && (
              <a href={`tel:${item.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Phone className="size-3" />
                {item.phone}
              </a>
            )}
            {item.email && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <Mail className="size-3 shrink-0" />
                <span className="truncate">{item.email}</span>
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canBook && (
          <Button size="sm" onClick={onBook}>
            <CalendarPlus className="size-3.5" />
            Dar turno
          </Button>
        )}
        {item.phone && (
          <Button variant="outline" size="sm" asChild>
            <a href={whatsAppLink(item.phone, whatsappText)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-3.5" />
              WhatsApp
            </a>
          </Button>
        )}
        {item.email && !notified && (
          <Button
            variant="outline"
            size="sm"
            disabled={notify.isPending}
            onClick={() => notify.mutate({ id: item.id })}
            title="Le mandamos un email con el link para que reserve ese día"
          >
            {notify.isPending ? <Spinner /> : <Mail className="size-3.5" />}
            Avisar por email
          </Button>
        )}

        <div className="ml-auto">
          {confirmRemove ? (
            <span className="inline-flex items-center gap-2 text-xs">
              ¿Sacarlo de la lista?
              <Button
                variant="outline"
                size="sm"
                disabled={remove.isPending}
                onClick={() => remove.mutate({ id: item.id })}
              >
                {remove.isPending ? <Spinner /> : null}
                Sí, sacar
              </Button>
              <button
                type="button"
                onClick={() => setConfirmRemove(false)}
                className="font-medium text-muted-foreground hover:text-foreground"
              >
                No
              </button>
            </span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmRemove(true)}
              aria-label={`Sacar a ${name} de la lista de espera`}
            >
              <Trash2 className="size-3.5" />
              <span className="hidden sm:inline">Sacar</span>
            </Button>
          )}
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </li>
  );
}
