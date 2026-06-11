"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Play, UserX, Ban, CalendarClock, Banknote, Link2, CircleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AppointmentStatusBadge } from "@/components/appointment-status-badge";
import {
  useConfirm,
  useStart,
  useComplete,
  useNoShow,
} from "@/lib/api/generated/endpoints/appointments/appointments";
import { useCancelAppointment } from "@/lib/api/appointments";
import { usePayments, useMarkPaymentPaid, useCreatePaymentPreference } from "@/lib/api/billing";
import { AppointmentStatus } from "@/lib/api/generated/model/appointmentStatus";
import { personDisplayName } from "@/lib/agenda";
import { formatDateLong, formatTime, formatMoney } from "@/lib/format";
import type { AxiosError } from "axios";
import type { Appointment } from "@/lib/api/generated/model/appointment";
import type { Service } from "@/lib/api/generated/model/service";

export function AppointmentDetail({
  appointment,
  services,
  staffName,
  onClose,
  onChanged,
}: {
  appointment: Appointment;
  services: Service[];
  staffName: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const service = services.find((s) => s.id === appointment.serviceId);
  const confirm = useConfirm();
  const start = useStart();
  const complete = useComplete();
  const noShow = useNoShow();
  const cancel = useCancelAppointment();
  const busy =
    confirm.isPending ||
    start.isPending ||
    complete.isPending ||
    noShow.isPending ||
    cancel.isPending;

  const id = appointment.id;
  const run = (m: { mutate: (v: { id: string }, o: object) => void }) =>
    m.mutate({ id }, { onSuccess: onChanged });
  const doCancel = () =>
    cancel.mutate({ id, data: {} }, { onSuccess: onChanged });

  const status = appointment.status;
  const isLive =
    status === AppointmentStatus.requested ||
    status === AppointmentStatus.confirmed ||
    status === AppointmentStatus.in_progress;
  const isClosed =
    status === AppointmentStatus.done ||
    status === AppointmentStatus.no_show ||
    status === AppointmentStatus.cancelled;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{personDisplayName(appointment.personId)}</DialogTitle>
            <AppointmentStatusBadge
              status={appointment.status}
              isProvisional={appointment.isProvisional}
            />
          </div>
        </DialogHeader>

        <div className="space-y-3 px-6">
          <Row label="Servicio" value={service?.name ?? "—"} />
          <Row label="Profesional" value={staffName} />
          <Row
            label="Cuándo"
            value={`${formatDateLong(appointment.startAt)} · ${formatTime(appointment.startAt)}–${formatTime(appointment.endAt)}`}
          />
          {service && <Row label="Precio" value={formatMoney(service.priceCents)} />}
          {appointment.isProvisional && (
            <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground">
              Turno provisional: sin seña, puede ser tomado por quien abone.
            </p>
          )}
          <DepositSection appointmentId={appointment.id} onChanged={onChanged} />
        </div>

        {/* Acciones según estado */}
        <div className="mt-4 space-y-2 p-6 pt-3">
          {appointment.status === AppointmentStatus.requested && (
            <Button className="w-full" onClick={() => run(confirm)} disabled={busy}>
              {confirm.isPending ? <Spinner /> : <Check className="size-4" />}
              Confirmar turno
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
          {appointment.status === AppointmentStatus.in_progress && (
            <Button className="w-full" onClick={() => run(complete)} disabled={busy}>
              {complete.isPending ? <Spinner /> : <Check className="size-4" />}
              Marcar como atendido
            </Button>
          )}

          {/* Acciones negativas (si el turno sigue vivo) */}
          {isLive && (
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
                onClick={doCancel}
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

  if (payment.status === "paid") {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-xs text-success">
        <Check className="size-3.5" />
        Seña de {formatMoney(payment.amountCents)} cobrada.
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
        Seña pendiente · {formatMoney(payment.amountCents)}
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
          <Link href="/ajustes/pagos" className="font-medium underline">
            Cobros
          </Link>{" "}
          para generar links.
        </p>
      )}
    </div>
  );
}
