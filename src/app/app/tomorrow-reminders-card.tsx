"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BellRing, Check, CheckCheck, MessageCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAppointmentsSetClientConfirmed } from "@/lib/api/generated/endpoints/appointments/appointments";
import { useProfessional } from "@/lib/api/professional";
import { PUBLIC_HOST } from "@/components/public-page-link";
import { AppointmentStatus } from "@/lib/api/generated/model/appointmentStatus";
import {
  appointmentMessage,
  appointmentWhenText,
  confirmUrl,
  whatsAppLink,
} from "@/lib/whatsapp";
import { formatTime, titleCaseName } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/lib/api/generated/model/appointment";

/** A quiénes ya se les mandó el recordatorio desde este equipo: { [appointmentId]: cuándo }. */
const SENT_KEY = "costa-reminders-sent";
/** Los registros viejos se descartan (el turno ya pasó). */
const SENT_TTL_MS = 3 * 24 * 3_600_000;

function readSent(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(SENT_KEY) ?? "{}") as Record<string, number>;
    const floor = Date.now() - SENT_TTL_MS;
    return Object.fromEntries(Object.entries(raw).filter(([, t]) => t > floor));
  } catch {
    return {};
  }
}

/**
 * "Mañana tenés N turnos": recordatorio por WhatsApp a cada cliente, en lote, con el link para
 * confirmar. Pensado para quien solo dejó el teléfono (el recordatorio automático sale por email).
 * Marca a quién ya se le escribió (en este equipo) y quién confirmó (en el servidor).
 */
export function TomorrowRemindersCard({ appointments }: { appointments: Appointment[] }) {
  const pro = useProfessional();
  const qc = useQueryClient();
  const mark = useAppointmentsSetClientConfirmed();
  const [sent, setSent] = useState<Record<string, number>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => setSent(readSent()), []);

  const list = appointments
    .filter(
      (a) =>
        (a.status === AppointmentStatus.requested || a.status === AppointmentStatus.confirmed) &&
        !a.checkedInAt,
    )
    .sort((x, y) => +new Date(x.startAt) - +new Date(y.startAt));
  if (list.length === 0) return null;

  const confirmed = list.filter((a) => a.clientConfirmedAt).length;
  const toRemind = list.filter((a) => !a.clientConfirmedAt && a.personPhone && !sent[a.id]).length;

  function markSent(id: string) {
    const next = { ...readSent(), [id]: Date.now() };
    setSent(next);
    try {
      localStorage.setItem(SENT_KEY, JSON.stringify(next));
    } catch {
      // sin almacenamiento: solo se pierde la marca de "enviado"
    }
  }

  function toggleConfirmed(a: Appointment) {
    setPendingId(a.id);
    mark.mutate(
      { id: a.id, data: { confirmed: !a.clientConfirmedAt } },
      {
        onSettled: () => setPendingId(null),
        onSuccess: () => void qc.invalidateQueries({ queryKey: ["appointments"] }),
      },
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="inline-flex items-center gap-2 font-display text-sm font-semibold">
          <BellRing className="size-4 text-accent" />
          Mañana tenés {list.length} turno{list.length === 1 ? "" : "s"}
        </h2>
        <p className="text-xs text-muted-foreground">
          {confirmed} de {list.length} confirmaron
          {toRemind > 0 && ` · ${toRemind === 1 ? "falta" : "faltan"} ${toRemind} por recordar`}
        </p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Mandales un recordatorio por WhatsApp con el link para confirmar. Bajan mucho las ausencias.
      </p>

      <ul className="mt-3 divide-y divide-border">
        {list.map((a) => {
          const name = titleCaseName(a.personName ?? "") || "Cliente";
          const isConfirmed = !!a.clientConfirmedAt;
          const wasSent = !!sent[a.id];
          const text = appointmentMessage("reminder", {
            clientName: name,
            whenText: appointmentWhenText(a.startAt),
            timeText: formatTime(a.startAt),
            serviceName: a.serviceName,
            businessName: pro.data?.businessName ?? null,
            confirmUrl: confirmUrl(PUBLIC_HOST, a.manageToken),
          });
          return (
            <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
              <span className="w-11 shrink-0 font-display text-sm font-semibold tabular-nums">
                {formatTime(a.startAt)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {titleCaseName(a.serviceName ?? "")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleConfirmed(a)}
                  disabled={pendingId === a.id}
                  aria-pressed={isConfirmed}
                  aria-label={
                    isConfirmed
                      ? `${name} confirmó. Tocá para desmarcar`
                      : `${name} sin confirmar. Tocá si te confirmó por mensaje`
                  }
                  title={isConfirmed ? "Desmarcar" : "Marcar que confirmó (si te respondió)"}
                  className={cn(
                    "inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors",
                    isConfirmed
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-border text-muted-foreground hover:border-accent/50 hover:text-foreground",
                  )}
                >
                  {pendingId === a.id ? <Spinner /> : <CheckCheck className="size-3.5" />}
                  {isConfirmed ? "Confirmó" : "Sin confirmar"}
                </button>
                {a.personPhone ? (
                  <Button
                    size="sm"
                    variant={wasSent || isConfirmed ? "ghost" : "outline"}
                    className="h-8"
                    asChild
                  >
                    <a
                      href={whatsAppLink(a.personPhone, text)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => markSent(a.id)}
                    >
                      {wasSent ? <Check className="size-4" /> : <MessageCircle className="size-4" />}
                      {wasSent ? "Enviado" : "Recordar"}
                    </a>
                  </Button>
                ) : a.personEmail ? (
                  <span
                    className="inline-flex h-8 items-center gap-1 px-2 text-xs text-muted-foreground"
                    title="No tiene teléfono: el recordatorio automático le llega por email"
                  >
                    <Mail className="size-3.5" />
                    Por email
                  </span>
                ) : (
                  <span className="inline-flex h-8 items-center px-2 text-xs text-muted-foreground">
                    Sin contacto
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
