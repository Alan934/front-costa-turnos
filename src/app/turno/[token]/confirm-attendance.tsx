"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCheck, CalendarX2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getApiErrorMessage } from "@/lib/api/error-message";
import {
  useConfirmByToken,
  useDeclineByToken,
  type ManagedAppointment,
} from "@/lib/api/me-appointments";
import { formatDateLong, formatTime } from "@/lib/format";

export type AttendanceIntent = "confirm" | "decline" | null;

/**
 * Pedido de confirmación del día anterior: "Confirmo" o "No puedo ir".
 *
 * - Desde el botón "Confirmo" del email (?r=si) se confirma solo al abrir la página.
 * - Desde "No puedo ir" (?r=no) se pide un toque más antes de cancelar: así un programa que
 *   abra los links del email para revisarlos no cancela un turno por su cuenta.
 */
export function ConfirmAttendance({
  appt,
  token,
  intent,
}: {
  appt: ManagedAppointment;
  token: string;
  intent: AttendanceIntent;
}) {
  const confirm = useConfirmByToken(token);
  const decline = useDeclineByToken(token);
  const [askingDecline, setAskingDecline] = useState(intent === "decline");
  const autoConfirmed = useRef(false);

  // El éxito de la mutación cuenta enseguida, sin esperar a que se recargue el turno.
  const confirmed = !!appt.clientConfirmedAt || confirm.isSuccess;
  const declined = decline.isSuccess;
  const open = appt.status === "requested" || appt.status === "confirmed";

  useEffect(() => {
    if (intent !== "confirm" || autoConfirmed.current || confirmed || !open) return;
    autoConfirmed.current = true;
    confirm.mutate();
  }, [intent, confirmed, open, confirm]);

  if (declined) {
    return (
      <Banner tone="muted" icon={<CalendarX2 className="size-5" />}>
        Listo, cancelamos tu turno. Gracias por avisar: el horario quedó libre para otra persona.
      </Banner>
    );
  }
  // Ya pasó, se canceló o lo están atendiendo: no hay nada que confirmar.
  if (!open || +new Date(appt.startAt) < Date.now()) return null;

  if (confirmed) {
    return (
      <Banner tone="success" icon={<CheckCheck className="size-5" />}>
        ¡Confirmaste tu turno! Te esperamos el {formatDateLong(appt.startAt)} a las{" "}
        {formatTime(appt.startAt)}.
      </Banner>
    );
  }

  const error = confirm.error ?? decline.error;
  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
      {askingDecline ? (
        <>
          <p className="font-medium">¿No podés venir?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cancelamos tu turno y el horario queda libre para otra persona. Si preferís otro día,
            podés reprogramarlo más abajo.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="text-destructive"
              disabled={decline.isPending}
              onClick={() => decline.mutate()}
            >
              {decline.isPending ? <Spinner /> : null}
              Sí, no puedo ir
            </Button>
            <Button variant="ghost" onClick={() => setAskingDecline(false)}>
              Volver
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="font-medium">¿Venís a tu turno?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Avisale al negocio con un toque. Si no podés, liberás el horario para otra persona.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              disabled={confirm.isPending}
              onClick={() => confirm.mutate()}
            >
              {confirm.isPending ? <Spinner /> : <CheckCheck className="size-4" />}
              Confirmo, voy
            </Button>
            <Button variant="outline" onClick={() => setAskingDecline(true)}>
              No puedo ir
            </Button>
          </div>
        </>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{getApiErrorMessage(error)}</p>}
    </div>
  );
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: "success" | "muted";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        tone === "success"
          ? "flex items-start gap-3 rounded-xl border border-success/40 bg-success/10 p-4 text-sm text-success"
          : "flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm"
      }
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p>{children}</p>
    </div>
  );
}
