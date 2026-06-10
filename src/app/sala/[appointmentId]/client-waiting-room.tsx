"use client";

import { useMemo } from "react";
import { Users, Clock3, CheckCircle2, Hourglass, Wifi, WifiOff, Bell } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ErrorState } from "@/components/state-views";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppointment } from "@/lib/realtime/use-appointment";
import { useWaitingRoom, type ConnectionState } from "@/lib/realtime/use-waiting-room";
import { AppointmentStatus } from "@/lib/api/generated/model/appointmentStatus";
import { formatTime, formatRelativeMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WaitingRoom, WaitingItem } from "@/mocks/contract-extensions";

export function ClientWaitingRoom({ appointmentId }: { appointmentId: string }) {
  const apt = useAppointment(appointmentId);
  const staffId = apt.data?.staffId ?? "";
  const { room, isLoading, isError, refetch, connection } = useWaitingRoom(staffId);

  const loading = apt.isLoading || (!!staffId && isLoading);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10">
      <header className="flex items-center justify-between py-5">
        <span className="font-display text-sm font-semibold tracking-tight text-muted-foreground">
          Costa Turnos
        </span>
        <div className="flex items-center gap-2">
          <ConnectionPill state={connection} />
          <ThemeToggle />
        </div>
      </header>

      {(apt.isError || isError) && (
        <div className="py-10">
          <ErrorState
            title="No pudimos cargar tu turno"
            message="Revisá el enlace o tu conexión."
            onRetry={() => (apt.isError ? apt.refetch() : refetch())}
          />
        </div>
      )}

      {loading && <ClientSkeleton />}

      {!loading && !apt.isError && room && apt.data && (
        <ClientContent room={room} myAppointmentId={appointmentId} />
      )}
    </div>
  );
}

function ClientContent({
  room,
  myAppointmentId,
}: {
  room: WaitingRoom;
  myAppointmentId: string;
}) {
  const { me, ahead, total } = useMemo(() => {
    const all: WaitingItem[] = [
      ...(room.nowServing ? [room.nowServing] : []),
      ...room.queue,
    ];
    const me = all.find((i) => i.appointmentId === myAppointmentId) ?? null;
    const ahead = me ? Math.max(0, me.position) : 0;
    return { me, ahead, total: room.queue.length + (room.nowServing ? 1 : 0) };
  }, [room, myAppointmentId]);

  const serving = me && room.nowServing?.appointmentId === me.appointmentId;
  const done = me?.status === AppointmentStatus.done;

  // Caso: ya fue atendido o no está en la cola viva.
  if (!me || done) {
    return (
      <BigState
        tone="done"
        icon={<CheckCircle2 className="size-9" />}
        title={done ? "¡Listo, fuiste atendido!" : "Tu turno ya no está en la cola"}
        subtitle={
          done
            ? "Gracias por venir. ¡Te esperamos la próxima!"
            : "Si creés que es un error, hablá con el local."
        }
      />
    );
  }

  if (serving) {
    return (
      <BigState
        tone="serving"
        icon={<Bell className="size-9" />}
        title="¡Es tu turno!"
        subtitle={`Pasá con ${room.staffName}. Te están esperando.`}
        ticket={me.ticketNumber}
      />
    );
  }

  // En cola: mostrar posición + ETA, en grande.
  return (
    <div className="flex flex-1 flex-col">
      <div className="rounded-3xl border border-border bg-card p-7 text-center">
        <p className="text-sm text-muted-foreground">Tu turno</p>
        <p className="mt-1 font-display text-6xl font-semibold tabular-nums text-accent">
          #{me.ticketNumber}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Stat
            icon={<Users className="size-4" />}
            value={String(ahead)}
            label={ahead === 1 ? "persona adelante" : "personas adelante"}
          />
          <Stat
            icon={<Clock3 className="size-4" />}
            value={me.etaMinutes <= 0 ? "Ya casi" : `~${me.etaMinutes}'`}
            label={me.etaMinutes <= 0 ? "es tu turno" : formatRelativeMinutes(me.etaMinutes)}
          />
        </div>
      </div>

      {/* Mini cola (sin nombres completos: nombre de pila / nº de turno) */}
      <div className="mt-6">
        <p className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Hourglass className="size-4" />
          En el local · {total} en espera
        </p>
        <ol className="space-y-2">
          {room.nowServing && (
            <QueueRow item={room.nowServing} serving highlightMe={false} />
          )}
          {room.queue.map((item) => (
            <QueueRow
              key={item.appointmentId}
              item={item}
              serving={false}
              highlightMe={item.appointmentId === myAppointmentId}
            />
          ))}
        </ol>
      </div>

      <p className="mt-auto pt-8 text-center text-xs text-muted-foreground">
        Esta pantalla se actualiza sola. Te avisaremos cuando sea tu turno.
      </p>
    </div>
  );
}

function QueueRow({
  item,
  serving,
  highlightMe,
}: {
  item: WaitingItem;
  serving: boolean;
  highlightMe: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3.5 py-2.5",
        serving
          ? "border-status-serving-foreground/30 bg-status-serving"
          : highlightMe
            ? "border-accent bg-accent/10"
            : "border-border bg-card",
      )}
    >
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg font-display text-sm font-semibold tabular-nums",
          serving ? "bg-status-serving-foreground/15 text-status-serving-foreground" : "bg-muted",
        )}
      >
        {item.ticketNumber}
      </span>
      <span className="flex-1 text-sm font-medium">
        {/* Privacidad (Ley 25.326): solo nombre de pila. */}
        {item.displayName}
        {highlightMe && <span className="ml-1.5 text-xs text-accent">(vos)</span>}
      </span>
      <span
        className={cn(
          "text-xs",
          serving ? "font-medium text-status-serving-foreground" : "text-muted-foreground",
        )}
      >
        {serving ? "En atención" : formatTime(item.startAt)}
      </span>
    </li>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl bg-muted/60 p-4">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">{icon}</span>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function BigState({
  tone,
  icon,
  title,
  subtitle,
  ticket,
}: {
  tone: "serving" | "done";
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  ticket?: number;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
      <span
        className={cn(
          "grid size-20 place-items-center rounded-full",
          tone === "serving"
            ? "bg-status-serving text-status-serving-foreground"
            : "bg-status-done text-status-done-foreground",
        )}
      >
        {icon}
      </span>
      {ticket != null && (
        <p className="mt-5 font-display text-5xl font-semibold tabular-nums text-accent">
          #{ticket}
        </p>
      )}
      <h1 className="mt-4 font-display text-2xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function ConnectionPill({ state }: { state: ConnectionState }) {
  const map: Record<ConnectionState, { label: string; live: boolean }> = {
    connecting: { label: "Conectando…", live: false },
    live: { label: "En vivo", live: true },
    polling: { label: "En vivo", live: true },
    offline: { label: "Sin conexión", live: false },
  };
  const { label, live } = map[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        live
          ? "border-status-serving-foreground/30 text-status-serving-foreground"
          : "border-border text-muted-foreground",
      )}
    >
      {live ? (
        <>
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-current" />
          </span>
          {label}
        </>
      ) : state === "offline" ? (
        <>
          <WifiOff className="size-3.5" />
          {label}
        </>
      ) : (
        <>
          <Wifi className="size-3.5" />
          {label}
        </>
      )}
    </span>
  );
}

function ClientSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-52 w-full rounded-3xl" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
