"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Check,
  Play,
  UserX,
  Ban,
  CalendarClock,
  CalendarRange,
  CheckCheck,
  Banknote,
  Link2,
  CircleAlert,
  Clock,
  LogIn,
  Repeat,
  Wallet,
  MessageCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { AppointmentStatusBadge } from "@/components/appointment-status-badge";
import { ChargeDialog } from "@/components/charge-dialog";
import {
  useAppointmentsConfirm,
  useAppointmentsStart,
  useAppointmentsComplete,
  useAppointmentsNoShow,
  useAppointmentsCheckIn,
  useAppointmentsSetClientConfirmed,
} from "@/lib/api/generated/endpoints/appointments/appointments";
import { useCancelAppointment } from "@/lib/api/appointments";
import { usePayments, useMarkPaymentPaid, useCreatePaymentPreference } from "@/lib/api/billing";
import { AppointmentStatus } from "@/lib/api/generated/model/appointmentStatus";
import { CashOutcome } from "@/lib/api/generated/model/cashOutcome";
import { formatDateLong, formatDateTime, formatTime, formatMoney } from "@/lib/format";
import {
  appointmentMessage,
  appointmentWhenText,
  whatsAppLink,
  type AppointmentMessageKind,
} from "@/lib/whatsapp";
import { useProfessional } from "@/lib/api/professional";
import { PUBLIC_HOST } from "@/components/public-page-link";
import { cn } from "@/lib/utils";
import type { AxiosError } from "axios";
import type { Appointment } from "@/lib/api/generated/model/appointment";
import type { Service } from "@/lib/api/generated/model/service";
import type { Payment } from "@/lib/api/generated/model/payment";
import type { PersonInfo } from "@/lib/api/clients";
import { RescheduleDialog } from "./reschedule-dialog";

export function AppointmentDetail({
  appointment,
  services,
  staffName,
  person,
  onClose,
  onChanged,
}: {
  appointment: Appointment;
  services: Service[];
  staffName: string;
  person: PersonInfo;
  onClose: () => void;
  onChanged: () => void;
}) {
  const service = services.find((s) => s.id === appointment.serviceId);
  const confirm = useAppointmentsConfirm();
  const start = useAppointmentsStart();
  const complete = useAppointmentsComplete();
  const noShow = useAppointmentsNoShow();
  const checkIn = useAppointmentsCheckIn();
  const cancel = useCancelAppointment();
  const busy =
    confirm.isPending ||
    start.isPending ||
    complete.isPending ||
    noShow.isPending ||
    checkIn.isPending ||
    cancel.isPending;

  const id = appointment.id;
  const run = (m: { mutate: (v: { id: string }, o: object) => void }) =>
    m.mutate({ id }, { onSuccess: onChanged });
  // Lo cancela el profesional desde su agenda (antes quedaba como "canceló el cliente": salía en
  // las novedades del inicio como cancelación de un cliente y no ofrecía "otro horario").
  const doCancel = (includeFollowing = false) =>
    cancel.mutate(
      { id, data: { reason: "professional", includeFollowing } },
      { onSuccess: onChanged },
    );
  // Turno fijo: al cancelar se pregunta si es solo este o también los siguientes.
  const [askSeriesCancel, setAskSeriesCancel] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);

  // Pago en persona (efectivo o transferencia) aún sin cobrar de este turno: al marcar "atendido"
  // pedimos confirmar si lo recibió (collected → pagado) o quedó en un pagaré (deferred → debe).
  // Así el cobro no infla las métricas hasta que el profesional confirma que recibió la plata.
  const { data: payments } = usePayments();
  const cashPayment = payments?.find(
    (p) =>
      (p.appointmentId as unknown as string) === id &&
      (p.method === "cash" || p.method === "transfer") &&
      (p.status === "pending" || p.status === "deferred"),
  );
  const [askCash, setAskCash] = useState(false);
  const [charging, setCharging] = useState(false);

  function completeAppointment(cashOutcome?: CashOutcome, note?: string) {
    complete.mutate(
      { id, data: cashOutcome ? { cashOutcome, ...(note ? { note } : {}) } : {} },
      { onSuccess: onChanged },
    );
  }

  // Marcar atendido: si hay efectivo pendiente, primero preguntamos el resultado del cobro.
  function onMarkDone() {
    if (cashPayment) setAskCash(true);
    else completeAppointment();
  }

  const status = appointment.status;
  const isLive =
    status === AppointmentStatus.requested ||
    status === AppointmentStatus.confirmed ||
    status === AppointmentStatus.in_progress;
  // Se puede mover mientras no haya llegado ni empezado (y tenga un servicio con horario).
  const canReschedule =
    (status === AppointmentStatus.requested || status === AppointmentStatus.confirmed) &&
    !appointment.checkedInAt &&
    !!appointment.serviceId;
  const isClosed =
    status === AppointmentStatus.done ||
    status === AppointmentStatus.no_show ||
    status === AppointmentStatus.cancelled;

  return (
    <>
    <Dialog open={!rescheduling} onOpenChange={(o) => !o && !charging && !rescheduling && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{person.name}</DialogTitle>
            <AppointmentStatusBadge
              status={appointment.status}
              isProvisional={appointment.isProvisional}
            />
          </div>
        </DialogHeader>

        <div className="space-y-3 px-6">
          <Row label="Servicio" value={service?.name ?? "Sin servicio"} />
          <Row label="Profesional" value={staffName} />
          <Row
            label="Cuándo"
            value={`${formatDateLong(appointment.startAt)} · ${formatTime(appointment.startAt)}–${formatTime(appointment.endAt)}`}
          />
          {appointment.seriesId && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Repeat className="size-3.5" />
              Turno fijo: se repite con la misma hora.
            </p>
          )}
          <ClientConfirmation appointment={appointment} />
          {person.phone && (
            <ContactRow
              label="Teléfono"
              value={person.phone}
              href={whatsAppLink(person.phone)}
            />
          )}
          {person.email && (
            <ContactRow label="Email" value={person.email} href={`mailto:${person.email}`} />
          )}
          {service && <Row label="Precio" value={formatMoney(service.priceCents)} />}
          {appointment.isProvisional && (
            <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground">
              Turno provisional: sin seña, puede ser tomado por quien abone.
            </p>
          )}
          <DepositSection appointmentId={appointment.id} onChanged={onChanged} />
          {person.phone && (
            <WhatsAppShortcuts
              appointment={appointment}
              phone={person.phone}
              clientName={person.name}
              serviceName={service?.name ?? null}
            />
          )}
        </div>

        {/* Acciones según estado */}
        <div className="mt-4 space-y-2 p-6 pt-3">
          {appointment.status === AppointmentStatus.requested && (
            <Button className="w-full" onClick={() => run(confirm)} disabled={busy}>
              {confirm.isPending ? <Spinner /> : <Check className="size-4" />}
              Confirmar turno
            </Button>
          )}
          {/* Llegada: mete el turno en la sala de espera con su número. Sin esto
              el cliente no figura en la fila ni puede ver cuántos tiene delante. */}
          {appointment.status === AppointmentStatus.confirmed && !appointment.checkedInAt && (
            <Button className="w-full" onClick={() => run(checkIn)} disabled={busy}>
              {checkIn.isPending ? <Spinner /> : <LogIn className="size-4" />}
              Llegó (entra a la sala)
            </Button>
          )}
          {appointment.checkedInAt && (
            <p className="text-center text-xs text-muted-foreground">
              En la sala de espera
              {/* El número es el lugar en la fila: en atención ya no lo tiene (otro es el #1). */}
              {appointment.ticketNumber && appointment.status === AppointmentStatus.confirmed
                ? ` · turno #${appointment.ticketNumber}`
                : ""}
            </p>
          )}
          {/* Cobro: QR de Mercado Pago, "ya pagó" o pagaré. Disponible mientras lo atienden y
              después, por si en el momento no se pudo cobrar. */}
          {(appointment.status === AppointmentStatus.in_progress ||
            appointment.status === AppointmentStatus.done) && (
            <Button variant="outline" className="w-full" onClick={() => setCharging(true)}>
              <Wallet className="size-4" />
              Cobrar
            </Button>
          )}
          {(appointment.status === AppointmentStatus.confirmed ||
            appointment.status === AppointmentStatus.requested) && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => run(start)}
              disabled={busy}
            >
              {start.isPending ? <Spinner /> : <Play className="size-4" />}
              Iniciar atención
            </Button>
          )}
          {appointment.status === AppointmentStatus.in_progress && !askCash && (
            <Button className="w-full" onClick={onMarkDone} disabled={busy}>
              {complete.isPending ? <Spinner /> : <Check className="size-4" />}
              Marcar como atendido
            </Button>
          )}

          {appointment.status === AppointmentStatus.in_progress && askCash && cashPayment && (
            <CashOutcomePanel
              payment={cashPayment}
              pending={complete.isPending}
              onCollected={() => completeAppointment(CashOutcome.collected)}
              onDeferred={(note) => completeAppointment(CashOutcome.deferred, note)}
              onCancel={() => setAskCash(false)}
            />
          )}

          {canReschedule && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setRescheduling(true)}
              disabled={busy}
            >
              <CalendarRange className="size-4" />
              Cambiar horario
            </Button>
          )}

          {/* Turno fijo: ¿solo este o también los siguientes? */}
          {askSeriesCancel && (
            <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm font-medium">Es un turno fijo. ¿Qué querés cancelar?</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => doCancel(false)} disabled={busy}>
                  Solo este
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => doCancel(true)}
                  disabled={busy}
                >
                  {cancel.isPending ? <Spinner /> : null}
                  Este y los siguientes
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAskSeriesCancel(false)}
                  disabled={busy}
                >
                  Volver
                </Button>
              </div>
            </div>
          )}

          {/* Acciones negativas (si el turno sigue vivo y no estamos cerrando el cobro) */}
          {isLive && !askCash && !askSeriesCancel && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="flex-1 text-muted-foreground"
                onClick={() => run(noShow)}
                disabled={busy}
              >
                <UserX className="size-4" />
                No vino
              </Button>
              <Button
                variant="ghost"
                className="flex-1 text-destructive hover:bg-destructive/10"
                onClick={() => (appointment.seriesId ? setAskSeriesCancel(true) : doCancel())}
                disabled={busy}
              >
                <Ban className="size-4" />
                Cancelar
              </Button>
            </div>
          )}

          {/* Estado terminal */}
          {isClosed && (
            <p className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
              <CalendarClock className="size-4" />
              Este turno ya está cerrado.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
    {rescheduling && (
      <RescheduleDialog
        appointment={appointment}
        clientName={person.name}
        clientPhone={person.phone}
        clientEmail={person.email}
        serviceName={service?.name ?? null}
        onClose={() => setRescheduling(false)}
        onDone={() => {
          setRescheduling(false);
          onChanged();
        }}
      />
    )}
    {charging && (
      <ChargeDialog
        appointmentId={appointment.id}
        clientName={person.name}
        onClose={() => {
          setCharging(false);
          onChanged();
        }}
      />
    )}
    </>
  );
}

const DELAYS = [10, 15, 30];

/**
 * Mensajes de WhatsApp con un toque: abren WhatsApp con el texto ya escrito y el profesional
 * toca "Enviar". Se ofrece lo que tiene sentido según el estado del turno: recordarlo o avisar
 * una demora mientras está vigente, ofrecer otro horario si se canceló.
 */
function WhatsAppShortcuts({
  appointment,
  phone,
  clientName,
  serviceName,
}: {
  appointment: Appointment;
  phone: string;
  clientName: string;
  serviceName: string | null;
}) {
  const pro = useProfessional();
  const [delay, setDelay] = useState(false);
  const status = appointment.status;
  const upcoming =
    (status === AppointmentStatus.requested || status === AppointmentStatus.confirmed) &&
    !appointment.checkedInAt;
  // El texto dice "tuve que cancelar": solo aplica si no canceló el propio cliente.
  const cancelled =
    status === AppointmentStatus.cancelled && appointment.cancellationReason !== "client";
  if (!upcoming && !cancelled) return null;

  const base = {
    clientName,
    whenText: appointmentWhenText(appointment.startAt),
    timeText: formatTime(appointment.startAt),
    serviceName,
    businessName: pro.data?.businessName ?? null,
    bookUrl: pro.data?.slug ? `https://${PUBLIC_HOST}/r/${pro.data.slug}` : null,
  };
  const href = (kind: AppointmentMessageKind, delayMinutes?: number) =>
    whatsAppLink(phone, appointmentMessage(kind, { ...base, delayMinutes }));
  const linkProps = { target: "_blank", rel: "noopener noreferrer" } as const;

  return (
    <div className="rounded-lg border border-border p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <MessageCircle className="size-3.5" />
        Escribirle por WhatsApp
      </p>
      <div className="flex flex-wrap gap-2">
        {upcoming && (
          <>
            <Button size="sm" variant="outline" asChild>
              <a href={href("reminder")} {...linkProps}>
                Recordarle el turno
              </a>
            </Button>
            {delay ? (
              <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
                Demora de
                {DELAYS.map((m) => (
                  <Button key={m} size="sm" variant="outline" asChild>
                    <a href={href("delay", m)} {...linkProps} onClick={() => setDelay(false)}>
                      {m} min
                    </a>
                  </Button>
                ))}
              </span>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setDelay(true)}>
                Avisar demora
              </Button>
            )}
          </>
        )}
        {cancelled && (
          <Button size="sm" variant="outline" asChild>
            <a href={href("rebook")} {...linkProps}>
              Ofrecerle otro horario
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * ¿El cliente confirmó que viene? Lo marca él desde el recordatorio ("Confirmo") o el
 * profesional a mano (p. ej. le respondió por WhatsApp). Solo en turnos que todavía no llegaron.
 */
function ClientConfirmation({ appointment }: { appointment: Appointment }) {
  const qc = useQueryClient();
  const mark = useAppointmentsSetClientConfirmed();
  const [confirmedAt, setConfirmedAt] = useState(appointment.clientConfirmedAt ?? null);
  const upcoming =
    (appointment.status === AppointmentStatus.requested ||
      appointment.status === AppointmentStatus.confirmed) &&
    !appointment.checkedInAt;
  if (!upcoming && !confirmedAt) return null;

  function toggle(confirmed: boolean) {
    mark.mutate(
      { id: appointment.id, data: { confirmed } },
      {
        onSuccess: (a) => {
          setConfirmedAt(a.clientConfirmedAt ?? null);
          void qc.invalidateQueries({ queryKey: ["appointments"] });
        },
      },
    );
  }

  return confirmedAt ? (
    <p className="flex items-center gap-1.5 text-xs text-success">
      <CheckCheck className="size-3.5" />
      Confirmó que viene · {formatDateTime(confirmedAt)}
      {upcoming && (
        <button
          type="button"
          onClick={() => toggle(false)}
          disabled={mark.isPending}
          className="ml-1 text-muted-foreground underline-offset-2 hover:underline"
        >
          Desmarcar
        </button>
      )}
    </p>
  ) : (
    <button
      type="button"
      onClick={() => toggle(true)}
      disabled={mark.isPending}
      className="flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
    >
      {mark.isPending ? <Spinner /> : <CheckCheck className="size-3.5" />}
      Marcar que confirmó que viene
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

/** Fila de contacto: el valor es un enlace (WhatsApp / email) para escribirle al cliente. */
function ContactRow({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-right font-medium text-accent hover:underline"
      >
        {value}
      </a>
    </div>
  );
}

/**
 * Al cerrar un turno con efectivo pendiente, el profesional confirma el resultado del cobro:
 * `collected` (recibió la plata → pago pagado) o `deferred` (pagaré: el cliente quedó debiendo,
 * con motivo opcional). En ambos casos el turno se marca como atendido en la misma llamada.
 */
function CashOutcomePanel({
  payment,
  pending,
  onCollected,
  onDeferred,
  onCancel,
}: {
  payment: Payment;
  pending: boolean;
  onCollected: () => void;
  onDeferred: (note?: string) => void;
  onCancel: () => void;
}) {
  const [defer, setDefer] = useState(false);
  const [note, setNote] = useState("");
  const methodLabel = payment.method === "transfer" ? "transferencia" : "efectivo";

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-sm font-medium">
        Cobro en {methodLabel} · {formatMoney(payment.amountCents)}
      </p>
      <p className="text-xs text-muted-foreground">
        ¿Recibiste el pago al finalizar el turno?
      </p>

      {!defer ? (
        <div className="space-y-2">
          <Button className="w-full" onClick={onCollected} disabled={pending}>
            {pending ? <Spinner /> : <Banknote className="size-4" />}
            Sí, cobré en {methodLabel}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setDefer(true)}
            disabled={pending}
          >
            <Clock className="size-4" />
            No, queda en pagaré
          </Button>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="w-full py-1 text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Volver
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <Label htmlFor="cash-note">Nota (opcional)</Label>
            <Input
              id="cash-note"
              className="mt-1.5"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: paga la semana que viene"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            El turno queda atendido y el cliente aparece en el cierre de caja como pendiente de pago.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDefer(false)}
              disabled={pending}
            >
              Volver
            </Button>
            <Button
              className={cn("flex-1")}
              onClick={() => onDeferred(note.trim() || undefined)}
              disabled={pending}
            >
              {pending ? <Spinner /> : null}
              Confirmar pagaré
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Cobro de la seña del turno. Busca un pago pendiente asociado y deja cobrarlo en efectivo
 * (mark-paid) o generar un link de MercadoPago (mp-preference). Si MP no está conectado, el
 * back responde 400 y guiamos al profesional a Cobros.
 */
function DepositSection({ appointmentId, onChanged }: { appointmentId: string; onChanged: () => void }) {
  const { data: payments } = usePayments();
  const markPaid = useMarkPaymentPaid();
  const preference = useCreatePaymentPreference();
  const [notConnected, setNotConnected] = useState(false);

  const payment = payments?.find(
    (p) => (p.appointmentId as unknown as string) === appointmentId,
  );
  if (!payment) return null;

  // El tipo del pago refleja lo que eligió el cliente: seña (deposit) o pago completo (service).
  const isFull = payment.type === "service";
  const kindLabel = isFull ? "Pago completo" : "Seña";

  if (payment.status === "paid") {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-xs text-success">
        <Check className="size-3.5" />
        {kindLabel} de {formatMoney(payment.amountCents)} {isFull ? "cobrado" : "cobrada"}.
      </p>
    );
  }

  function genLink() {
    setNotConnected(false);
    preference.mutate(
      { id: payment!.id },
      {
        onSuccess: (res) => {
          if (res?.initPoint) window.open(res.initPoint, "_blank", "noopener");
        },
        onError: (err) => {
          if ((err as AxiosError).response?.status === 400) setNotConnected(true);
        },
      },
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-xs font-medium">
        {kindLabel} pendiente · {formatMoney(payment.amountCents)}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => markPaid.mutate(payment.id, { onSuccess: onChanged })}
          disabled={markPaid.isPending}
        >
          {markPaid.isPending ? <Spinner /> : <Banknote className="size-4" />}
          Cobré en efectivo
        </Button>
        <Button size="sm" variant="outline" onClick={genLink} disabled={preference.isPending}>
          {preference.isPending ? <Spinner /> : <Link2 className="size-4" />}
          Link de pago
        </Button>
      </div>
      {notConnected && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-warning-foreground">
          <CircleAlert className="size-3.5" />
          Conectá MercadoPago en{" "}
          <Link href="/app/cobros" className="font-medium underline">
            Cobros
          </Link>{" "}
          para generar links.
        </p>
      )}
    </div>
  );
}
