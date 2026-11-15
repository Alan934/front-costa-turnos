"use client";

import { useState } from "react";
import { CalendarCheck, MessageCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAppointmentsReschedule } from "@/lib/api/generated/endpoints/appointments/appointments";
import { getApiErrorMessage } from "@/lib/api/error-message";
import { useProfessional } from "@/lib/api/professional";
import { formatDateLong, formatTime } from "@/lib/format";
import { appointmentMessage, appointmentWhenText, whatsAppLink } from "@/lib/whatsapp";
import type { Appointment } from "@/lib/api/generated/model/appointment";
import { fromDateInputValue, TimeField, toDateInputValue, useTimeChoice } from "./time-picker";

/**
 * "Cambiar horario": el profesional mueve un turno a otro día u hora sin cancelarlo y crearlo
 * de nuevo (mismo cliente, servicio, quién atiende, seña y adicionales). Se elige entre los
 * horarios libres del día o uno a mano.
 *
 * Al guardar, el cliente recibe un email con el horario nuevo (si tiene email y no se destilda)
 * y se ofrece avisarle por WhatsApp con el mensaje ya escrito.
 */
export function RescheduleDialog({
  appointment,
  clientName,
  clientPhone,
  clientEmail,
  serviceName,
  onClose,
  onDone,
}: {
  appointment: Appointment;
  clientName: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  serviceName: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [date, setDate] = useState(() => {
    const d = new Date(appointment.startAt);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const timeChoice = useTimeChoice(date, appointment.staffId, appointment.serviceId ?? "");
  const startAt = timeChoice.startAt;
  const [notify, setNotify] = useState(true);
  const reschedule = useAppointmentsReschedule();
  const [moved, setMoved] = useState<Appointment | null>(null);
  const pro = useProfessional();

  function pickDate(value: string) {
    const d = fromDateInputValue(value);
    if (!d) return;
    setDate(d);
    timeChoice.reset();
  }

  function save() {
    if (!startAt) return;
    reschedule.mutate(
      {
        id: appointment.id,
        data: { startAt: startAt.toISOString(), notifyClient: !!clientEmail && notify },
      },
      { onSuccess: (a) => setMoved(a) },
    );
  }

  const sameTime = !!startAt && +startAt === +new Date(appointment.startAt);

  if (moved) {
    const message = appointmentMessage("moved", {
      clientName,
      whenText: appointmentWhenText(moved.startAt),
      timeText: formatTime(moved.startAt),
      serviceName,
      businessName: pro.data?.businessName ?? null,
    });
    return (
      <Dialog open onOpenChange={(o) => !o && onDone()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Listo, turno cambiado</DialogTitle>
            <DialogDescription>
              {clientName} ahora tiene turno el {formatDateLong(moved.startAt)} a las{" "}
              {formatTime(moved.startAt)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-6">
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <CalendarCheck className="mt-0.5 size-4 shrink-0 text-success" />
              {clientEmail && notify
                ? "Le mandamos un email con el horario nuevo, y el recordatorio va a llegar para la fecha nueva."
                : "El recordatorio va a llegar para la fecha nueva."}
            </p>
            {clientPhone && (
              <Button variant="outline" className="w-full" asChild>
                <a href={whatsAppLink(clientPhone, message)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-4" />
                  Avisarle por WhatsApp
                </a>
              </Button>
            )}
          </div>
          <div className="p-6 pt-3">
            <Button className="w-full" onClick={onDone}>
              Listo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar horario</DialogTitle>
          <DialogDescription>
            {clientName} · ahora: {formatDateLong(appointment.startAt)} a las{" "}
            {formatTime(appointment.startAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-2">
          <div>
            <Label htmlFor="rs-date">Día</Label>
            <Input
              id="rs-date"
              type="date"
              className="mt-1.5"
              value={toDateInputValue(date)}
              min={toDateInputValue(new Date())}
              onChange={(e) => pickDate(e.target.value)}
            />
          </div>

          <TimeField choice={timeChoice} inputId="rs-time" />

          {clientEmail ? (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[var(--color-accent)]"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
              />
              <span>
                Avisarle por email con el horario nuevo
                <span className="block text-xs text-muted-foreground">{clientEmail}</span>
              </span>
            </label>
          ) : (
            <p className="text-xs text-muted-foreground">
              No tiene email: después de guardar te dejamos el mensaje listo para mandarle por
              WhatsApp.
            </p>
          )}

          {reschedule.isError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {getApiErrorMessage(reschedule.error)}
            </div>
          )}
        </div>

        <div className="p-6 pt-3">
          <Button
            className="w-full"
            disabled={!startAt || sameTime || reschedule.isPending}
            onClick={save}
          >
            {reschedule.isPending ? <Spinner /> : null}
            {startAt && !sameTime
              ? `Pasar al ${formatDateLong(startAt)} · ${formatTime(startAt.toISOString())}`
              : "Elegí el horario nuevo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
